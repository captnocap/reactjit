// Shared schema for `cart/app/recipes/<slug>.ts` files. Each recipe file imports
// `RecipeDocument` from here and exports a single `recipe` constant matching it.
// The matching `<slug>.md` file holds the verbatim source from platform.claude.com;
// the `.ts` is our structured adaptation, ready for the runtime pass.

export type RecipeSectionKind = "paragraph" | "bullet-list" | "code-block";

export type RecipeCodeLanguage =
  | "python"
  | "typescript"
  | "tsx"
  | "javascript"
  | "bash"
  | "markdown"
  | "text";

export interface RecipeParagraph {
  kind: "paragraph";
  title?: string;
  text: string;
}

export interface RecipeBulletList {
  kind: "bullet-list";
  title?: string;
  items: string[];
}

export interface RecipeCodeBlock {
  kind: "code-block";
  title?: string;
  language: RecipeCodeLanguage;
  code: string;
}

export type RecipeSection = RecipeParagraph | RecipeBulletList | RecipeCodeBlock;

export interface RecipeDocument {
  // URL-safe identifier; matches the filename stem of both `<slug>.ts` and `<slug>.md`.
  slug: string;
  // Human-readable title, mirrors the recipe heading.
  title: string;
  // Path to the verbatim markdown source, relative to repo root.
  sourcePath: string;
  // One-paragraph statement of what the recipe is for. Surfaced as the recipe summary.
  instructions: string;
  // Ordered structured content. Render in sequence.
  sections: RecipeSection[];
}
