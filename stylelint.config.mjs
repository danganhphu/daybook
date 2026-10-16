// Values that carry design decisions must come from tokens: abstracts functions or a custom property
const tokenFunctions = "color|space|radius|size|duration|easing|z|rem";
const tokenValue = `(${tokenFunctions})\\([^)]*\\)|var\\(--[\\w-]+\\)|0|auto|inherit|none|currentcolor|transparent|100%`;

/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard-scss"],
  plugins: ["stylelint-declaration-strict-value"],
  rules: {
    "scale-unlimited/declaration-strict-value": [
      [
        "/color$/",
        "background",
        "fill",
        "stroke",
        "box-shadow",
        "font-size",
        "font-weight",
        "line-height",
        "z-index",
        "border-radius",
        "/^(margin|padding|gap|row-gap|column-gap)/",
      ],
      {
        ignoreFunctions: false,
        ignoreValues: [`/^(${tokenValue})( (${tokenValue}))*$/`],
      },
    ],
    "color-named": "never",
    "color-no-hex": true,
    "declaration-no-important": true,
    "max-nesting-depth": 3,
    "selector-max-id": 0,
    "selector-max-compound-selectors": 3,
  },
  overrides: [
    {
      // The only files allowed to hold raw values
      files: ["styles/abstracts/**", "styles/themes/**", "styles/base/_reset.scss"],
      rules: { "scale-unlimited/declaration-strict-value": null },
    },
  ],
};
