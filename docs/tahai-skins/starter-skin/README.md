# Make your first TAHAI skin

Extract the creator kit to a writable folder. It contains this editable starter,
`build_skin.py`, and `starter-skin.tahaiskin`, which you can import immediately.
The included green preview image comes from Chromium under the accompanying
BSD license. Replace it with your own artwork and choose your own license.

For a visual editor, double-click **studio.html** in the extracted kit. Choose
your colors in the light, dark, and high-contrast palettes, enter your name and
unique skin ID, and click **Download .tahaiskin**. The editor works offline and
checks text contrast before exporting. Keep the adjacent JS and CSS files in
the same folder. The steps below also let you use custom artwork.

1. Copy `starter-skin` to `my-skin`.
2. Edit `my-skin/manifest.json`: change `id`, `name`, `creator`, and `license`.
   Use a unique ID with 3-64 lowercase letters, digits, and interior hyphens.
3. Change the light, dark, and high-contrast colors. Keep every token and use
   lowercase `#rrggbb`. The packager checks that text contrast is at least 4.5:1.
4. Replace `assets/preview.png` with a still PNG or WebP. Keep each image under
   4 MiB and 2048 by 2048 pixels. Update the path in the manifest if needed.
5. Check your Chromium major version at `chrome://version` and set the tested
   compatibility range. The included example targets version 152.
6. From the extracted kit folder, run these commands with Python 3.9 or newer:

   ```powershell
   py build_skin.py my-skin --check
   py build_skin.py my-skin my-first-skin.tahaiskin
   ```

The packager calculates asset hashes, includes only declared files, and creates
the required ZIP layout. It does not change your source or overwrite an existing
output file. Choose a new output name for the next revision. Avoid generic ZIP
commands that add directory entries: TAHAI intentionally rejects those entries.

In TAHAI, open **Skin packages > Review local file**, select the new package,
review its artwork and metadata, and install it. Review the installed package
and choose **Apply to browser colors**. Updates retain one previous revision.
To undo an update, review the previous revision, restore it, and apply it.
**Reset browser appearance** restores the native default.

The light/dark palettes style the native toolbar, tabs, frame, workspace rail,
and supported side-panel cards. The browser derives a supporting accent theme.
OS forced colors take priority. Origin text, security indicators, warnings,
permission prompts, focus rings, and websites retain native behavior. The
review includes an artwork card and **Try for 30 seconds** changes the browser
temporarily without saving preferences. Closing the review or choosing Revert
restores the saved appearance. **Export reviewed skin** saves the exact reviewed
archive. Compact density reduces rail spacing while preserving button sizes.
The first shell-decoration asset appears in a separate, noninteractive rail
slot, with no artwork behind labels or controls. Skin artwork is always still.

The browser performs the final sandboxed image and archive validation. A packager
check cannot replace that review, especially for WebP. Scripts, HTML, CSS,
network URLs, animation, SVG, unsafe paths, and undeclared assets are rejected.

If import fails, check the compatibility range, image encoding and dimensions,
and contrast error first. Rebuild after every asset change; the packager updates
hashes automatically. A failed import does not replace your installed skin.
