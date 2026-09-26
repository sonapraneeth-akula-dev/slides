# Assumptions and open status

- The mockup names title/content, two-column, three-column, and picture/text layouts; the requirements also request blank. Plan for five layouts and keep the separate four-layout milestone open pending implementation evidence.
- `.mdx` will mean a non-executing declarative deck source for this release. Imports, JSX, expressions, and custom components remain unsupported; code fences are displayed, not run.
- Default private host address is loopback with an OS-assigned port. The eventual LAN audience will require explicit opt-in, interface selection, a separate read-only public projection, and tested reachability; the bootstrap does not enable LAN access.
- The draft theme inventory, browser/OS matrix, licensing for fonts/media, file-picker portability, packaging, and reference performance hardware remain to be verified. No cross-platform or accessibility claims derive from this bootstrap.
- Exports, annotation saving through export, custom components, and authored-code execution are deferred. All library/editor/presenter/content/settings functionality remains open until its implementation and tests pass. No PRD requirement is marked complete here.
