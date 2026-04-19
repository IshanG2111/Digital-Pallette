# Production-Grade Color Grade Extraction & 3D LUT Pipeline

**Executive Summary:** A robust LUT-extraction pipeline must do much more than “pick dominant colors.” It should model how a style image’s colors and tones map to the target, producing a full 3D color transform that generalizes to new images. Key steps are: work in a perceptual/linear space (e.g. CIE-LAB or linear RGB)【21†L73-L82】; sample representative pixels (possibly weighted by exposure, faces/skins, etc.); compute statistical color transforms (mean/covariance matching, histogram/optimal-transport) rather than naive palette swaps【6†L148-L156】【16†L155-L163】; optionally split shadows/midtones/highlights and compute separate curves; then generate a 3D color cube (LUT) by applying the learned mapping to all grid points; and finally apply it via trilinear (or tetrahedral) interpolation.  In practice this yields results comparable to professional tools.  We cover color space choices, sampling strategies, statistical/color-moment matching, tone and color decomposition, LUT generation (with pseudocode), gamut handling, evaluation metrics, performance (GPU/shader) and more. This report cites state-of-the-art sources on color transfer and LUT design. 

## Goals and Constraints  
- **Goal:** Derive a *transfer function* f:RGB→RGB that encapsulates the visual style (color grade) of a reference image, and export it as a 3D LUT (or equivalent transforms) that can be *applied to any target image* with high fidelity (ideally matching professional grading in Photoshop/Lightroom).  
- **Constraints:** Must handle arbitrarily different content (no pixel correspondence), wide gamut and dynamic ranges, and run efficiently (real-time shader-friendly). The LUT must produce *smooth, artifact-free* results (no banding) across the gamut. Memory for the LUT cube is limited (especially on devices/cameras that only support 17³ or 33³ LUTs【28†L260-L268】). Any tone remapping should avoid crushing blacks/whites or altering highlights incorrectly. Ideally the method is robust to outliers and content variation (e.g. neutral or monochrome scenes).  

## Color Spaces & Gamma Handling  
**Working Space:** Perform all color-statistics and mapping in a decorrelated space. The seminal work of Reinhard *et al.* shows that **CIELAB** (or Ruderman’s Lαβ) has minimal cross-channel correlation and aligns with human perception【21†L81-L89】. Converting source and reference images from sRGB into LAB (or linear RGB) ensures transforms affect hue/chroma orthogonally. In practice: decode any gamma (sRGB) or log curves into linear light first. Then convert linear RGB to Lab (using D65 white). All distribution matching (means, covariances, histograms) is done in Lab space【21†L73-L82】. Finally, convert output back to the display gamut. 

- *Why not stay in RGB?* RGB channels are highly correlated in natural images【21†L75-L82】. A single brightness shift can produce cross-channel hue shifts. Lab (or lαβ) makes the axes roughly independent【21†L81-L89】.  
- *Linear vs Gamma:* For color transforms, use *linear light* values (gamma removed). Many professional pipelines (ACEScg, OpenColorIO) work in linear RGB and apply LUTs on linear data. If you operate on gamma-coded values, the transform won’t correspond to true light mixing. So first linearize (sRGB→linear via inverse gamma) before stats; if needed, reapply a curve or gamma after.  
- *Alternative spaces:* XYZ is linear but not perceptually uniform. You could use log RGB (for DSLR logs) if both images share log curves. But Lab is the industry standard for color matching【21†L81-L89】.  

## Pixel Sampling Strategy  
Instead of using *every* pixel (which is costly), sample a representative subset to compute statistics. Strategies include:  

- **Stratified Sampling:** Partition image (e.g. 16×16 grid) and take a random pixel from each cell. Ensures even coverage of shadows and highlights.  
- **Exposure Weighting:** More samples in midtones (most sensitive) and some in shadows/highlights. For example, sample proportionally to brightness distribution so rare dark/brights are not missed.  
- **Importance Sampling (Faces/Skin):** If the goal includes preserving skin tones or key regions, detect faces or skin patches and sample more heavily there. This ensures the transform is accurate on flesh tones (crucial for portrait grading). For instance, run a face detector or skin-color mask, then sample pixels from those regions with higher weight.  
- **Color Clustering:** (Optional) Do a quick clustering (e.g. k-means on a small pixel set) to find dominant colors, but use this only to seed sampling. Don’t rely solely on cluster centroids as the final palette – use them to guide sampling density.  

For most methods, sampling **5,000–20,000** pixels is sufficient for stable stats (or even fewer if well-stratified). See Pseudocode below for a simple sampler.  

```python
import numpy as np
def sample_pixels(img_lab, N=5000):
    h,w,_ = img_lab.shape
    # Random stratified sample
    ys = np.linspace(0,h,N//100,endpoint=False,dtype=int)
    xs = np.linspace(0,w,N//100,endpoint=False,dtype=int)
    ys = np.random.choice(ys, N, replace=True)
    xs = np.random.choice(xs, N, replace=True)
    return img_lab[ys, xs, :]
```  

No single sampling strategy is “ground truth” in literature, but this approach is common in production tools: random + stratified + optional region weighting.  

## Tone Splits: Shadows, Midtones, Highlights  
A robust grading pipeline often applies *different transforms* to shadows, midtones, and highlights. For example, a warm orange shift might apply only to midtones, while shadows remain cooler. To implement this:  

1. **Split Luminance:** Convert to LAB and examine L* (0–100). Define thresholds (e.g. L*<30=shadows, 30–70=midtones, >70=highlights).  
2. **Separate Stats:** Compute color statistics (mean, covariance) within each band of the reference *and* source.  
3. **Blend Transforms:** Learn three separate transfer functions (shadow, mid, high). When applying to a target pixel, weight its output by its L* band. You can either smoothly blend (e.g. weight by triangular functions) or define crisp curves.  
4. **Apply Curves:** Alternatively, use *tone curves*. Compute a global L* mapping (contrast curve) to match the reference’s overall brightness/histogram, and separately adjust “lift/gamma/gain” for color.  

This multi-band approach is analogous to Photoshop’s shadows/midtone/highlights sliders or 3-way color wheels. By handling each range, you avoid dragging colors out of balance (e.g. turning highlights muddy when only mids should shift). Empirical workflows often refine the midtone curve and leave shadows slightly boosted or highlight tone mapped differently.  

## Statistical & Distribution-Matching Methods  
After sampling pixels (in Lab), derive a color mapping. Here are common methods:

- **Mean+Variance (Reinhard et al., 2001):**  For each channel (L*, a*, b*), shift the mean and scale by standard deviation to match target. Essentially, `out = ((src - mean_src) * (std_tgt/std_src)) + mean_tgt`【16†L155-L163】. This is simple and often effective for “overall look,” but can miss differences in distribution shape. It assumes Gaussian-like color clouds.  
- **Covariance Whitening/Coloring (Xiao & Ma, 2006):**  Treat pixel colors as 3D vectors. Compute source mean μₛ and covariance Σₛ; target mean μₜ, Σₜ. Then whiten the source (subtract μₛ and apply Σₛ⁻¹ᐟ²) and re-color with Σₜ¹ᐟ² and add μₜ. Formally, the transform is `color_out = (Σₜ¹ᐟ² Σₛ⁻¹ᐟ²)(color_in - μₛ) + μₜ`. This preserves correlations (rotations) between channels【6†L148-L156】. It handles multi-dimensional shifts better than per-channel scaling. 
- **Histogram Matching:** Match the entire color CDF of one image to another (e.g. skimage’s `match_histograms`). You can do this per-channel in Lab or jointly via optimal transport (see below). Simple histogram matching can overshoot by copying rare spikes, causing artifacts【16†L155-L163】. It guarantees global distribution alignment but may preserve noise/artifacts from the reference.  
- **Optimal Transport (Monge Map):**  Conceptually, find the lowest-cost mapping of one color distribution to another. In 1D this is exactly histogram matching. In 3D color space, techniques like **sliced-Wasserstein** or **Monge map** have been used (e.g. Pitié and Kokaram’s work, see *“Colour Transfer with Optimal Transport”*【7†L18-L23】). These can be very accurate but are computationally heavy. Some modern methods learn a transport map with deep nets. If implementing, note that OT yields a *nonlinear* mapping, potentially requiring a very dense LUT or direct per-pixel remap.  
- **PCA/CCA Alignment:** Perform PCA on each image’s 3D colors to align axes, then transfer along these principal axes. Or use Canonical Correlation Analysis to align joint distributions. These are less common in production, but can improve if images have different channel importance.  

**Pseudocode for covariance-based transfer:** (in Lab space)  
```python
import numpy as np

def match_color_cov(src_lab, tgt_lab):
    # src_lab, tgt_lab: Nx3 sampled pixels
    μs = src_lab.mean(0); Σs = np.cov(src_lab, rowvar=False) + eps
    μt = tgt_lab.mean(0); Σt = np.cov(tgt_lab, rowvar=False)
    # Whitening transform
    Ls = np.linalg.cholesky(Σs)        # lower-triangular
    Lt = np.linalg.cholesky(Σt)
    transform = Lt @ np.linalg.inv(Ls)
    # Apply to source pixels (for building LUT below)
    def apply_transform(color): 
        return transform.dot(color - μs) + μt
    return apply_transform
```
This yields smooth grade-like changes【6†L148-L156】. You should clamp values after mapping to [0,100] L and Lab range.

In practice, you can *combine* methods: for example, use mean/cov transfer for coarse global match, then fine-tune histograms in each channel (or use a small 1D LUT per channel for final tonal matching). Or use linear combination of source L and target L histogram (e.g. 30% source, 70% target) to reduce artifacts. 

## Tone Curves, Contrast and Saturation  
Apart from color mapping, handle these components explicitly:  
- **Tone Curve (L* curve):**  Fit a curve to match the reference’s luminosity distribution. For instance, compute the cumulative histogram of L* in source and reference, derive a 1D mapping LUT (or a parametric S-curve). This adds global contrast or bend that mean/cov cannot capture. Many systems use “lift/gamma/gain” or spline curves on L*.  
- **Color Bias (Temperature/Tint):**  Adjust a* and b* offsets to simulate white balance or style. For example, if the style image has a teal-orange cast, add a vector to (a*,b*) in the source.  Practically, you might detect average a*/b* shift after the main transform and subtract it.  
- **Saturation:**  Increase/decrease chroma by scaling (a*, b*) channels away/toward gray. E.g., in Lab, multiply [a*, b*] by a factor >1 for more saturation. This can be a uniform multiplier or tone-dependent.  
These steps can be seen as “ancillary transforms.” Often one applies them *after* the statistical mapping, or jointly incorporate them into the transformation.  For example, you might train a model that outputs a *diagonal 3×3* scaling (saturation) and *diagonal offset* on top of the covariance transform.  

### Implementation Tip:
Store these as separate 1D LUTs or small curves (for L*, a*, b*) to apply either before or after the main 3D LUT. For instance, apply a global L* S-curve via a 1D lookup, then feed into the 3D LUT for color. This modularity also lets you expose lift/gamma/gain controls in the UI.

## Building the 3D LUT (Cube)  
Once the full color transform `T` is defined (from methods above), we **generate a 3D LUT** by sampling `T` on a regular grid of RGB values. Choose a grid size (17³, 33³, 65³) based on desired quality vs memory. Then for each grid point (r,g,b), compute the mapped color:

```python
def generate_3D_LUT(transform, size=33):
    # Create LUT array of shape (size,size,size,3)
    lut = np.zeros((size, size, size, 3), dtype=np.float32)
    for ri in range(size):
        for gi in range(size):
            for bi in range(size):
                color = np.array([ri, gi, bi], dtype=float) / (size-1) * 100  # if Lab L* 0-100, adjust as needed
                out = transform(color)
                lut[ri, gi, bi] = np.clip(out / 100.0, 0, 1)  # normalized for shader
    return lut
```

(**Note:** Use Lab or linear RGB *values* consistently. If using Lab space, you might build a LUT in Lab and convert output to sRGB. If working in RGB, transform in linear space and clip to [0,1]).

**Cube size tradeoff:** A larger grid yields finer accuracy (especially for smooth gradients and skin tones) but uses more memory【27†L125-L134】【28†L147-L156】. Typical sizes: 

| Grid size | Points (grid³) | Memory (float32) | Typical Use |
|-----------|---------------:|-----------------:|-------------|
| 17×17×17  | 4,913          | ~0.06 MB        | Low-end/monitor LUTs (in-camera) |
| 33×33×33  | 35,937         | ~0.43 MB        | Standard cinema grading (on-set, DIT)【28†L169-L178】 |
| 65×65×65  | 274,625        | ~3.3 MB         | Final-grade (HDR, color-critical)【58†L219-L228】【27†L125-L134】 |

【59†embed_image】 *Figure: A 3D LUT color cube. Left is a sparse 33×33×33 grid (banding visible); right is 65×65×65 (smooth interpolation). Each point defines a color mapping.*  

<sup>*Generated 3D LUTs sample the 3D color space (as shown). More points (65^3 vs 33^3) yield finer gradients【27†L125-L134】.*</sup>

Trilinear interpolation is used when applying the LUT (see next section). Note: our pseudocode above is simplistic; in practice one often precomputes an appropriate normalized LUT and uses GPU trilinear lookup (see Performance section).

## Applying the LUT (Trilinear Interpolation)  
To map a new image, treat each pixel’s RGB (or Lab) as a 3D coordinate in the LUT cube, then interpolate. **Trilinear interpolation** is standard: find the eight nearest cube vertices surrounding the color and do weighted average. Pseudocode:

```python
def apply_lut(img, lut):
    size = lut.shape[0]
    img = np.clip(img, 0, 1) * (size - 1)
    r0 = np.floor(img[...,0]).astype(int); r1 = np.clip(r0+1, 0, size-1)
    g0 = np.floor(img[...,1]).astype(int); g1 = np.clip(g0+1, 0, size-1)
    b0 = np.floor(img[...,2]).astype(int); b1 = np.clip(b0+1, 0, size-1)
    dr = img[...,0] - r0
    dg = img[...,1] - g0
    db = img[...,2] - b0
    # Fetch the 8 corners and interpolate (omitting full code for brevity)
    # ...
```

In real implementations, one would vectorize or write this in GLSL/HLSL as a 3D texture lookup with linear filtering (hardware does the trilinear math). Using a CUDA/Metal/WebGL 3D texture allows real-time performance even for 65³ LUTs.

**Interpolation variants:** Some professional tools use *tetrahedral interpolation*, which can yield slightly better accuracy (in many tests, tetrahedral ≈ bilinear with twice resolution)【28†L147-L156】. However, trilinear is simpler and universally supported. If banding persists with trilinear (especially on 33³), you may need 65³ or dithering.

## Gamut and Clipping Handling  
After mapping, colors may fall outside the display gamut. Strategies:  

- **Clipping:** Simply clamp each channel to [0,1]. This is fast but can desaturate clipped colors. It is the default in many shaders (and ColorAide’s `clip()` method)【52†L835-L843】.  
- **Scale/Gamut Map:** Instead of clipping, scale the *chroma* down so the color just fits within gamut, preserving hue. For example, in XYZ or linear RGB, you can shrink the R,G,B vector until all components ≤1.  Libraries like [ColorAide](https://facelessuser.github.io/coloraide/gamut/) implement a “scale” method that preserves the dominant wavelength (hue) while keeping the color within gamut【52†L842-L851】.  
- **Chromaticity compression:** Compress saturation in Lab or LCh so that no value is out-of-range. For instance, reduce L* or shrink a*,b* proportionally.  

In a pipeline, you may simply clamp and live with slight saturation loss. For critical accuracy, apply a perceptual gamut map (e.g. preserve hue, prioritize luminance or colorfulness)【52†L842-L851】. The choice depends on severity of overflow; test your LUT outputs for out-of-gamut artifacts. 

## Evaluation Metrics and Test Data  
To **evaluate** quality, use both objective and subjective measures:

- **ΔE (CIEDE2000):**  Average color difference in Lab between the LUT-graded image and a reference graded image. A mean ΔE <2 is typically imperceptible.  
- **SSIM / PSNR:** Structural similarity or peak SNR between the transformed image and ground truth. These measure overall fidelity including luminance structure. SSIM closer to 1 is better.  
- **LPIPS:** Learned perceptual metric (from AlexNet/VGG) for visual similarity. Useful if you have ground-truth style images.  
- **Visual Test:** Split-screen comparisons, checking for banding or hue shifts, especially in sky gradients and skin tones as highlighted by [58]. 

**Datasets:** Use varied scenes. Good choices: *Adobe MIT-5K* (5000 RAW photos with professional edits) for still photos; *HDR images* for contrast tests; movie stills for cinematic LUTs. Frame sequences with known grading LUTs (e.g. film ICtCp references) are ideal but less available. 

For research, some papers mention using *Condensed Movie Dataset* or other HDR galleries. In our context, test on “ground truth” pairs if available, else use multiple target images and judge consistency of style transfer.

## Performance and GPU/WebGL  
A production tool should apply LUTs in real time on GPU:  
- Use **3D textures**: Upload the LUT as a GL_RGB32F or similar 3D texture. Shader does a single tex3D lookup per pixel with linear filtering. On mobile GPUs this is efficient (hardware does the trilinear).  
- **Precision:** For 65³ LUTs, a full 32-bit float LUT is a few MB. You may use 16-bit floats (FP16) to halve memory. Many GPU LUT systems use half floats (or even 10-bit).  
- **Shader setup:** In a fragment shader, convert the linear input color to the LUT’s domain (normalize to [0,1] or [0,size-1]). Sample the 3D texture and output the color. For Tone Curves or additional steps, use a 1D texture or simple arithmetic.  
- **WebGL:** WebGL2 supports 3D textures; otherwise implement a 2D slice trick. Precompute the LUT offline and load.  
- **CPU fallback:** For environments without GPU, you can trilinearly interpolate in CPU (slow for large images) or use a compiled loop (NumPy/C++). Not ideal for real time.

## Failure Modes and Mitigations  
- **Extreme Difference in Scenes:** If source has no blacks (all midtones), mapping might clip darkness in target. Avoid by blending in a small amount of target identity (e.g. keep 5% of original shadow levels).  
- **Very High/Low Light:** If reference is much darker or brighter, L* mapping may over/underflow. Use a tone curve to match histograms instead of pure linear stats.  
- **Color Outliers:** Rare colors in the reference (e.g. neon objects) can skew covariances. Option: clamp or ignore pixels outside a main cluster, or use a robust statistics (e.g. ignore 1% extremes).  
- **Overfitting:** Histogram matching can “copy” speckles or sensor noise. Mitigate by smoothing the reference histogram or using coarser CDF bins.  
- **Gamut Violations:** If transform produces out-of-range values, they appear as clipping. Use gamut mapping.  

In general, always test on multiple different target images. If one method shows artifacts (e.g. banding with 33-cube), adjust (use 65-cube, dithering, or more complex interpolation).   

## Step-by-Step Implementation Plan  

1. **Data Input & Preprocessing:**  
   - Load source image (style reference) and target image. Convert from sRGB (8-bit/linear) to working space (linear and then to Lab). If images are RAW or log, linearize first.  
   - *Deliverable:* Image converter module (e.g. using OpenCV or colour-science libraries).  

2. **Pixel Sampling & Weighting:**  
   - Implement sampler as above. Optionally include face/skin detection (e.g. OpenCV Haar cascades or dlib for face regions, then skew sampling).  
   - *Deliverable:* Sampling routine; test by visualizing sampled points or histograms.  

3. **Compute Color Transforms:**  
   - **Global Stats:** Compute means and covariances (NumPy/scikit-learn). Generate whitening-coloring transform (pseudocode above).  
   - **Histogram Matching:** Optionally use `skimage.exposure.match_histograms` on Lab channels.  
   - **Per-band Mapping:** If using shadows/mid/high, compute separate means/covs or curves per band.  
   - *Deliverable:* Color transfer module(s) (e.g. `transfer_covariance(src_pixels, ref_pixels)`).  

4. **Tone Curves:**  
   - Fit 1D curves for L* (e.g. match CDFs or fit polynomial). Also derive saturation multipliers or a* bias.  
   - *Deliverable:* Curve functions (could use `numpy.interp` or small LUT tables).  

5. **Combine into Transform Function:**  
   - Build a composite transform function `T(color)` that applies (a) bias/scale (saturation, white balance), (b) principal transform (covariance), (c) tone curve (L* remap).  
   - *Deliverable:* A callable transform (e.g. Python function or small PyTorch model) for any Lab color.  

6. **LUT Generation:**  
   - Use `generate_3D_LUT(transform, size)` to build a LUT array. Start with size 33.  
   - If memory permits and higher quality needed, do size 65.  
   - *Deliverable:* Export `.cube` file or raw array. The CUBE format is simple plain text.  

7. **Apply LUT:**  
   - Write trilinear interpolation code (Python or C++). For CPU testing, implement as above.  
   - In GPU, write a fragment shader or WebGL code that samples from a 3D texture.  
   - *Deliverable:* Shader or GPU code example, plus CPU fallback.  

8. **Testing & Validation:**  
   - Apply the LUT to various images. Compute ΔE, SSIM vs reference-graded images (if available). Visually inspect.  
   - Tweak thresholds or interpolation if artifacts.  
   - *Deliverable:* Test suite and metrics report.  

**Libraries/Tools:** OpenCV (color conversion, basic stats), scikit-image (`match_histograms`), NumPy, SciPy. For deep learning approaches, PyTorch/TensorFlow. For GPU: GLSL (WebGL), OpenGL/DirectX, or CUDA for fast CPU. For prototyping, Colour-Science for Lab conversions, and OpenColorIO for workflows.  

## Comparison of Methods  

| Method / Strategy                 | Quality & Effect              | Computational Cost   | Runtime Speed   | Robustness (artifacts)            |
|-----------------------------------|-------------------------------|----------------------|-----------------|-----------------------------------|
| **Reinhard (mean/σ in Lab)**【16†L155-L163】 | Good for general color casts, simple “global style” | **Low** (O(N) stats)        | **Fast** (few ops) | Medium – fails on complex, copies major color bias only |
| **Covariance (whitening-coloring)**【6†L148-L156】 | Stronger match of color distribution, preserves hue shifts | **Medium** (matrix math)    | **Moderate** (fast on CPU) | High – smoother than per-channel, avoids weird hue drift |
| **Histogram Matching (1D)**【16†L155-L163】 | Can be very accurate for distribution *along each axis* | **Medium** (sort/CDF)       | **Moderate** (skimage optimized) | Low – tends to overfit, banding/artifacts from quirks |
| **Optimal Transport (OT)**       | Very accurate *global* match of palettes | **High** (iterative OT solver) | **Slow** (not real-time) | Medium – sensitive to noise, needs regularization |
| **PCA/CCA Alignment**            | Aligns principal color axes | **Medium** (PCA cost)      | **Moderate**          | Low – can introduce color rotations that look odd |
| **Deep Learning / 3D-CNN LUT**【55†L9-L12】 | Very high (learns subtle cues) | **High** (train CNN)       | **Fast** (once trained) | Medium – needs training data, may hallucinate |
| **1D Tone-Curve Only**           | Basic contrast/ exposure fix | **Very Low** (lookup)      | **Fast**             | Low – no hue changes, limited use |

*Summary:* Simple stats (mean/std, covariance) are fast and cover many use cases. Histogram/OT give better matching but risk artifacts. Deep learning methods (beyond scope) can learn optimal LUTs from data but require training. Ultimately, a *hybrid* (covariance + gentle curve + LUT) is often best: it’s efficient, robust, and avoids overfitting.  

## Pipeline Flowchart  

```mermaid
graph TB
    A[Source Photo (Color Grade Reference)] --> B(Linearize & convert to Lab)
    B --> C(Sample Pixels (uniform + importance))
    C --> D{Compute Transforms}
    D --> |Global stats| E(Mean/Cov Matching in Lab)
    D --> |Tone & Sat| F(Tone Curve & Saturation)
    D --> |(Optional) Local| G(Shadow/Mid/Highlight Partition)
    E & F & G --> H(Combine into unified Color Transform T)
    H --> I(Generate 3D LUT Grid (17³/33³/65³))
    I --> J["Cube LUT (.cube)"]
    K[Target Photo] --> L(Linearize & Lab conv)
    L --> M(Apply LUT via 3D Trilinear Interp.)
    M --> N(De-gamma / Convert to sRGB)
    N --> O[Output Graded Photo]
    style I stroke:#f66,stroke-width:2px
    style M stroke:#f66,stroke-width:2px
```

*Figure: Pipeline flow. Key stages: convert images to working color space, sample pixels, compute color and tone transforms, generate a 3D LUT cube, then apply that LUT to new images.  (Components in red—LUT gen & apply—are performance-critical.)*  

## References

- Reinhard *et al.* – “Color Transfer between Images” (2001), classic global mean/std Lab transfer【21†L73-L82】.  
- Xiao & Ma – “Color transfer in correlated color space” (ACM 2006), covariance/SVD color matching【6†L148-L156】.  
- PixInsight / Scikit-image docs – histogram matching (see skimage’s `match_histograms`).  
- Alastemple blog (2026) – Detailed LUT grid discussion, 17/33/65 example【27†L125-L129】【28†L147-L156】.  
- ColorAide gamut mapping – “scale” method preserves hue【52†L842-L851】.  
- Wikipedia “Image color transfer” – notes histogram vs mean/std approaches【16†L155-L163】.  
- **Implementation:** OpenCV (cv2.cvtColor for Lab), scikit-image, numpy linear algebra, skimage.exposure. LUT: Adobe `.cube` format or Three.js DataTexture3D example.  

(See citations inline for sources on color spaces【21†L81-L89】, transfer methods【6†L148-L156】【16†L155-L163】, LUT grid effects【27†L125-L134】【28†L147-L156】, etc.)