# Operational starter skin

This is a complete version 2 skin template. Copy this folder, give it a unique
identity, then edit the `operational` object to define reviewed layouts, native
start surfaces, instructions, checkpoints, and the fixed action vocabulary.

Run:

```powershell
py build_skin.py operational-starter-skin --check
py build_skin.py operational-starter-skin my-operational-skin.tahaiskin
```

After install and appearance apply, open **Skin packages** and click the
explicit activation button for the mode. It applies the mode's layout, rail,
start surface, and reviewed commands. It never opens arbitrary URLs or runs
code from a skin.