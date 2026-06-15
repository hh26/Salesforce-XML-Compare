Salesforce XML Merge Engine
A high-performance, browser-based utility designed for Salesforce developers to compare, merge, and resolve conflicts in metadata XML files (e.g., Permission Sets, Profiles) without the frustration of line-scrambling or hidden metadata shifts.

Features
Logical Comparison: Compares XML metadata semantically, ignoring tag order so that reordered nodes don't trigger false-positive diffs.

Side-by-Side Merge Editor: A clean, IDE-inspired UI that lets you see Original (A) and Modified (B) files side-by-side.

Conflict Resolution: * Block-Level Merging: Push entire permission blocks (e.g., <fieldPermissions>) from one file to the other with a single click (➔ / ⬅).

Line-Level Merging: Fine-tune your merges by pushing specific XML lines individually.

Inline Editing: Click any code block to edit it manually. Changes are instantly reflected in the background engine.

Undo/Redo: Full support for Ctrl + Z to revert merge actions or manual edits.

Zero-Dependency: Runs 100% client-side in your browser. Your metadata never leaves your machine—perfect for secure enterprise environments.

Usage
Upload or Paste: Use the toggle buttons at the top of each pane to either upload your .xml files or paste metadata directly from your clipboard.

Compare: Click the "Compare & Refresh" button to generate the diff report.

Merge: Use the arrows in the center gutter to push changes left or right. Use the "Copy" buttons in the header to export the resolved XML file to your clipboard.

How it Works
Parser: The engine parses the XML into a structured dictionary, treating the first non-boolean tag (like <field> or <apexClass>) as the unique key. This preserves the logical identity of the permission regardless of its position in the XML file.

Reconstructor: The engine preserves the original file's formatting, outputting the XML back in the exact order it was parsed, ensuring your Salesforce deployments remain clean and formatted.