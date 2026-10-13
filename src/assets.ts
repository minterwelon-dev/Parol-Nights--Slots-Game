// Asset manifest. Critical art is generated in BootScene (add critical WebP files there once real art exists);
// files here are fetched by the loader after boot.
// `?url` gives a hashed URL in the build, so swapping in real WebP / audio never changes module APIs.
import bigwin from '../Assets/audio/bigwin.mp3?url';
import click from '../Assets/audio/click.mp3?url';
import coin from '../Assets/audio/coin.mp3?url';
import feature from '../Assets/audio/feature.mp3?url';
import spin from '../Assets/audio/spin.mp3?url';
import stop from '../Assets/audio/stop.mp3?url';
import tease from '../Assets/audio/tease.mp3?url';
import win from '../Assets/audio/win.mp3?url';

/** Loaded while the player sits on the first Idle screen; spin stays disabled until done. */
export const SFX = { spin, stop, click, coin, win, bigwin, feature, tease } as const;
export type SfxKey = keyof typeof SFX;
