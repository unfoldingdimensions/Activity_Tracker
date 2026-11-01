"""List the manifests actually embedded in a PE file, and which one Windows will read.

    python scripts/manifest-resources.py <exe>

Windows loads the first RT_MANIFEST resource with id 1 for an executable, so "two manifests, both id 1" is not a
cosmetic warning — it means one of them is dead weight (D-053). The Win32 enumeration helpers hide that: they resolve by
(id, type) and will happily report the same resource twice, which is why this parses the PE resource directory instead.
"""
import struct
import sys


def rva_to_offset(sections, rva):
    for _name, vaddr, vsize, rawptr, rawsize in sections:
        if vaddr <= rva < vaddr + max(vsize, rawsize):
            return rawptr + (rva - vaddr)
    raise ValueError(f"rva {rva:#x} is not inside any section")


def main(path):
    data = open(path, "rb").read()
    if data[:2] != b"MZ":
        raise SystemExit("not a PE file")

    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe : pe + 4] != b"PE\0\0":
        raise SystemExit("no PE header")
    sections_count = struct.unpack_from("<H", data, pe + 6)[0]
    opt_size = struct.unpack_from("<H", data, pe + 20)[0]
    opt = pe + 24
    magic = struct.unpack_from("<H", data, opt)[0]
    data_dirs = opt + (112 if magic == 0x20B else 96)
    resource_rva, resource_size = struct.unpack_from("<II", data, data_dirs + 2 * 8)

    sections = []
    section_header = opt + opt_size
    for i in range(sections_count):
        offset = section_header + i * 40
        name = data[offset : offset + 8].rstrip(b"\0").decode("ascii", "replace")
        vsize, vaddr, rawsize, rawptr = struct.unpack_from("<IIII", data, offset + 8)
        sections.append((name, vaddr, vsize, rawptr, rawsize))

    base = rva_to_offset(sections, resource_rva)
    rows = []

    def walk(offset, path):
        named, ids = struct.unpack_from("<HH", data, offset + 12)
        for i in range(named + ids):
            entry = offset + 16 + i * 8
            name_field, target = struct.unpack_from("<II", data, entry)
            if target & 0x80000000:
                walk(base + (target & 0x7FFFFFFF), path + [name_field])
                continue
            if not path or path[0] != 24:  # RT_MANIFEST
                continue
            lang = name_field
            dir_entry = base + target
            data_rva, size, _codepage, _reserved = struct.unpack_from("<IIII", data, dir_entry)
            body_offset = rva_to_offset(sections, data_rva)
            body = data[body_offset : body_offset + size]
            # Match elements, not words: these manifests carry comments, and a comment mentioning dpiAware is not a
            # dpiAware element. (The first version of this script reported a feature the manifest did not have.)
            kind = []
            if b"Common-Controls" in body:
                kind.append("common-controls")
            if b"<longPathAware>" in body:
                kind.append("longPathAware")
            if b"<requestedExecutionLevel" in body:
                kind.append("asInvoker")
            if b"<dpiAware" in body:
                kind.append("dpiAware")
            rows.append((path[1], lang, size, ", ".join(kind) or "unrecognised"))

    walk(base, [])
    print(f"{path}: {len(rows)} RT_MANIFEST entr{'y' if len(rows) == 1 else 'ies'}")
    for index, (res_id, lang, size, kind) in enumerate(rows):
        marker = "  <- Windows reads this one" if index == 0 else ""
        print(f"  id={res_id} lang={lang} size={size} [{kind}]{marker}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
