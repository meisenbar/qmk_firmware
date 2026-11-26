#include QMK_KEYBOARD_H

enum unicode_names {
    AUML,
    UUML,
    OUML,
    SUML
};

const uint32_t PROGMEM unicode_map[] = {
    [AUML]  = 0xC3A4,  // ‽
    [UUML] = 0xC3BC,  // ⸮
    [OUML]  = 0xC3B6, // 🐍
    [SUML]  = 0xC39F, // 🐍
};

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
    [0] = LAYOUT(
        QK_GESC,        KC_1,    KC_2,            KC_3,    KC_4,    KC_5,    KC_6,    KC_7,    KC_8,    KC_9,    KC_0,    KC_MINS,         KC_EQL,  KC_BSPC,
        KC_TAB,         KC_Q,    KC_W,            KC_E,    KC_R,    KC_T,    KC_Y,    KC_U,    KC_I,    KC_O,    KC_P,    KC_LBRC,         KC_RBRC, KC_BSLS,
        LT(1, KC_ESC),  KC_A,    KC_S,            KC_D,    KC_F,    KC_G,    KC_H,    KC_J,    KC_K,    KC_L,    KC_SCLN, KC_QUOT,                  KC_ENT,
        KC_LSFT,                 KC_Z,            KC_X,    KC_C,    KC_V,    KC_B,    KC_N,    KC_M,    KC_COMM, KC_DOT,  RSFT_T(KC_SLSH), KC_UP,   LT(2, KC_DEL),
        KC_LCTL,        KC_LALT, KC_LGUI,                       KC_SPC,                  KC_RALT, MO(1),   KC_LEFT,         KC_DOWN, KC_RGHT
    ),
    [1] = LAYOUT(
        TO(3),   KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,   KC_F6,   KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_F11,  KC_F12,  KC_DEL,
        _______, _______, _______,   RALT(KC_5), RM_TOGG, _______, KC_CALC, RALT(KC_Y), KC_INS,  RALT(KC_P), KC_PSCR, KC_SCRL, KC_PAUS, QK_BOOT,
        _______, RALT(KC_Q), RALT(KC_S), _______, _______, _______, KC_LEFT, KC_DOWN, KC_UP, KC_RGHT, KC_HOME, KC_GRV,   EE_CLR,
        _______,          _______, _______, _______, _______, _______, NK_TOGG, _______, _______, KC_END,  KC_RSFT, KC_VOLU, KC_MUTE,
        _______, _______, _______,                            TO(4),                     KC_MPLY, _______, KC_MPRV, KC_VOLD, KC_MNXT
    ),
    [2] = LAYOUT(
        _______, KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,   KC_F6,   KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_F11,  KC_F12,  KC_DEL,
        _______, RM_TOGG, _______, _______, _______, _______, _______, RM_VALU, RM_VALD, _______, _______, _______, _______, QK_BOOT,
        _______, _______, _______, _______, _______, _______, _______, _______, _______, _______, _______, _______,          EE_CLR,
        _______,          _______, _______, _______, _______, _______, _______, _______, _______, _______, _______, _______, _______,
        _______, _______, _______,                            _______,                   _______, _______, _______, _______, _______
    ),
    [3] = LAYOUT(
        KC_NUM,  KC_PSLS, KC_PAST, KC_PMNS, KC_PPLS, _______, _______, _______, _______, KC_PSLS, KC_PAST, KC_PMNS, KC_PPLS, _______,
        _______, KC_P7,   KC_P8,   KC_P9,   _______, _______, _______, _______, KC_P7,   KC_P8,   KC_P9,   _______, _______, TO(0),
        _______, KC_P4,   KC_P5,   KC_P6,   _______, _______, _______, _______, KC_P4,   KC_P5,   KC_P6,   _______,          KC_PENT,
        _______,          KC_P1,   KC_P2,   KC_P3,   _______, _______, _______, _______, KC_P1,   KC_P2,   KC_P3,   _______, _______,
        _______, KC_P0,   KC_PDOT,                            KC_PENT,                   KC_P0,   KC_PDOT, _______, _______, _______
    )
};

// Flow Tap, except right after Space: a word-initial capital needs RSFT_T(KC_SLSH) to hold.
uint16_t get_flow_tap_term(uint16_t keycode, keyrecord_t *record, uint16_t prev_keycode) {
    if (prev_keycode == KC_SPC) return 0;
    if (is_flow_tap_key(keycode) && is_flow_tap_key(prev_keycode)) return FLOW_TAP_TERM;
    return 0;
}

// Per-key colour overrides set by a host script over VIA's custom channel (RAM only).
// SET:   [0x07, 0x00, 0x01, n, (led, r, g, b) * n]   CLEAR: [0x07, 0x00, 0x02]
static uint8_t override_rgb[RGB_MATRIX_LED_COUNT][3];
static uint8_t override_set[(RGB_MATRIX_LED_COUNT + 7) / 8];

void via_custom_value_command_kb(uint8_t *data, uint8_t length) {
    if (length < 3 || data[1] != id_custom_channel) {
        data[0] = id_unhandled;
        return;
    }
    switch (data[2]) {
        case 0x01: {
            if (length < 4) return;
            uint8_t n = data[3];
            for (uint8_t k = 0; k < n && 4 + 4 * k + 3 < length; k++) {
                uint8_t *e = &data[4 + 4 * k];
                if (e[0] >= RGB_MATRIX_LED_COUNT) continue;
                override_rgb[e[0]][0] = e[1];
                override_rgb[e[0]][1] = e[2];
                override_rgb[e[0]][2] = e[3];
                override_set[e[0] / 8] |= 1 << (e[0] % 8);
            }
            break;
        }
        case 0x02:
            memset(override_set, 0, sizeof(override_set));
            break;
        default:
            data[0] = id_unhandled;
    }
}

#define BLINK_MS 150
static bool     blink_active;
static bool     blink_then_disable;
static uint8_t  blink_count;
static uint16_t blink_timer;

bool rgb_matrix_indicators_user(void) {
    uint8_t v = rgb_matrix_get_val();
    for (uint8_t i = 0; i < RGB_MATRIX_LED_COUNT; i++) {
        if (override_set[i / 8] & (1 << (i % 8))) {
            rgb_matrix_set_color(i, override_rgb[i][0] * v / 255, override_rgb[i][1] * v / 255, override_rgb[i][2] * v / 255);
        }
    }
    if (blink_active) {
        uint8_t tab = g_led_config.matrix_co[1][0];
        bool    on  = (timer_elapsed(blink_timer) / BLINK_MS) % 2 == 0;
        if (tab != NO_LED) rgb_matrix_set_color(tab, on ? RGB_MATRIX_MAXIMUM_BRIGHTNESS : 0, on ? RGB_MATRIX_MAXIMUM_BRIGHTNESS : 0, on ? RGB_MATRIX_MAXIMUM_BRIGHTNESS : 0);
    }
    return true;
}

// RM_TOGG feedback: blink the Tab LED white. On->off blinks once and disables afterwards; off->on enables, then blinks 3 times.
bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (keycode != RM_TOGG) return true;
    if (record->event.pressed && !blink_active) {
        blink_then_disable = rgb_matrix_is_enabled();
        blink_count        = blink_then_disable ? 1 : 3;
        if (!blink_then_disable) rgb_matrix_enable();
        blink_active = true;
        blink_timer  = timer_read();
    }
    return false;
}

void housekeeping_task_user(void) {
    if (blink_active && timer_elapsed(blink_timer) >= 2 * BLINK_MS * blink_count) {
        blink_active = false;
        if (blink_then_disable) rgb_matrix_disable();
    }
}

// Only the dark BLANK effect: undo any effect picked via VIA/qmk_hid on every boot.
void keyboard_post_init_user(void) {
    rgb_matrix_mode_noeeprom(RGB_MATRIX_CUSTOM_BLANK);
}
