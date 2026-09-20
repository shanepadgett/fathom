import type * as esbuild from "esbuild";
import { transformAsync } from "@babel/core";
import solid from "babel-preset-solid";
import typescript from "@babel/preset-typescript";

export const solidTransform: esbuild.Plugin = {
  name: "solid",
  setup(build) {
    build.onLoad({ filter: /\.tsx$/ }, async (args) => {
      const source = await Deno.readTextFile(args.path);

      const result = await transformAsync(source, {
        filename: args.path,
        presets: [
          [solid, { generate: "dom", hydratable: false }],
          [
            typescript,
            {
              isTSX: true,
              allExtensions: true,
            },
          ],
        ],
        babelrc: false,
        configFile: false,
      });

      return { contents: result!.code!, loader: "js" };
    });
  },
};
