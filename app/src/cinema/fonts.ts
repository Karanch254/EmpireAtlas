import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";

// Inter (SIL Open Font License, see public/fonts/Inter-LICENSE.txt),
// stored locally so text renders identically in the cloud and on Windows.
export const INTER = "Inter";

let loaded = false;

export const loadInter = () => {
  if (loaded) {
    return;
  }
  loaded = true;
  const handle = delayRender("Loading Inter font");
  const font = new FontFace(
    INTER,
    `url(${staticFile("fonts/InterVariable.woff2")}) format("woff2")`,
    { weight: "100 900" },
  );
  font
    .load()
    .then(() => {
      document.fonts.add(font);
      continueRender(handle);
    })
    .catch((err) => cancelRender(err));
};
