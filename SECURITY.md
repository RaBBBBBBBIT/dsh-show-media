# Security

`dsh_show_media` reads a local file the agent already named and shows it in the current conversation card.

- Preview bytes travel over the package-private `/dsh-show-media` RPC. They are not written to a public URL.
- The card does not occupy `shell.overlay`, so a preview cannot pin itself onto another session tab.
- This plugin does not replace official `read_image` and does not send file bytes to the model.
- Installing any DSH plugin runs third-party code with the host's permissions. Read the source before you install.
