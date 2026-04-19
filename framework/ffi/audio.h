#ifndef AUDIO_H
#define AUDIO_H

/* Audio subsystem — Zig exports (framework/audio.zig)
   All functions use long params/returns to match the .tsz compiler's FFI codegen.
   The compiler converts JS number → c_long for all declare function params. */

long audio_init(void);
long audio_deinit(void);
long audio_add_module(long id, long module_type);
long audio_remove_module(long id);
long audio_connect(long from_id, long from_port, long to_id, long to_port);
long audio_disconnect(long from_id, long from_port, long to_id, long to_port);
long audio_set_param(long module_id, long param_idx, long value);
long audio_note_on(long module_id, long note);
long audio_note_off(long module_id);
long audio_set_master_gain(long gain);
long audio_get_module_count(void);
long audio_get_callback_count(void);
long audio_get_callback_us(void);

#endif
