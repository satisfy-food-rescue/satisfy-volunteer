// Next generates next-env.d.ts (gitignored) on dev and build, so a fresh
// checkout typechecked in CI would not know static image imports such as
// "@/assets/photos/team.webp". Reference the same types here.
/// <reference types="next/image-types/global" />
