#!/usr/bin/env python3
"""Set per-key RGB overrides on the DZ60RGB v2 over raw HID (needs `pip install hidapi`).

  rgbkey.py set IDX RRGGBB [IDX RRGGBB ...]   LED indices follow rgb_matrix.layout in keyboard.json
  rgbkey.py clear
  rgbkey.py selftest                          no device needed
"""
import sys

VID, PID = 0x445A, 0x1121  # info.json usb.vid, v2/keyboard.json usb.pid


def build_packets(pairs):
    """pairs: [(led_index, 'RRGGBB'), ...] -> 33-byte HID reports (id 0 + 32 data), max 7 LEDs each."""
    out = []
    for i in range(0, len(pairs), 7):
        chunk = pairs[i:i + 7]
        body = bytes([0x07, 0x00, 0x01, len(chunk)])
        for idx, rgb in chunk:
            if len(rgb) != 6:
                raise ValueError(f"bad colour {rgb!r}")
            body += bytes([idx]) + bytes.fromhex(rgb)  # fromhex raises ValueError on bad hex
        out.append(b"\x00" + body.ljust(32, b"\x00"))
    return out


def send(packets):
    import hid
    path = next(d["path"] for d in hid.enumerate(VID, PID) if d["usage_page"] == 0xFF60 and d["usage"] == 0x61)
    dev = hid.device()
    dev.open_path(path)
    for p in packets:
        dev.write(p)
    dev.close()


def selftest():
    ps = build_packets([(i, "ff8000") for i in range(8)])
    assert [len(p) for p in ps] == [33, 33]
    assert ps[0][:9] == bytes([0, 7, 0, 1, 7, 0, 0xFF, 0x80, 0x00]) and ps[1][4] == 1 and ps[1][5] == 7
    for bad in ("zzzzzz", "fff"):
        try:
            build_packets([(0, bad)])
            raise AssertionError(bad)
        except ValueError:
            pass
    print("ok")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["selftest"]:
        selftest()
    elif a[:1] == ["clear"]:
        send([b"\x00" + bytes([0x07, 0x00, 0x02]).ljust(32, b"\x00")])
    elif a[:1] == ["set"] and len(a) > 2 and len(a) % 2 == 1:
        send(build_packets([(int(a[i]), a[i + 1]) for i in range(1, len(a), 2)]))
    else:
        sys.exit(__doc__)
