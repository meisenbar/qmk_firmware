// !!! DO NOT ADD #pragma once !!! //
RGB_MATRIX_EFFECT(BLANK)

#ifdef RGB_MATRIX_CUSTOM_EFFECT_IMPLS
// All LEDs off; per-key overrides and indicators are painted on top by rgb_matrix_indicators_user.
static bool BLANK(effect_params_t* params) {
    RGB_MATRIX_USE_LIMITS(led_min, led_max);
    for (uint8_t i = led_min; i < led_max; i++) {
        rgb_matrix_set_color(i, 0, 0, 0);
    }
    return rgb_matrix_check_finished_leds(led_max);
}
#endif
