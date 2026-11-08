---
name: genui
description: "Create useful interactive interfaces inside DSH replies with the dsh-ui JSON fence: step-by-step walkthroughs, calculators, comparisons, charts and forms. Use when operating or inspecting a surface adds value. Preserve conversation language for all user-visible text."
---

# GenUI / MIKUSCAT

Create a useful interface in the conversation. Its visual language is warm, quiet
and precise: Anthropic-inspired colour and typography, with clear grouping,
alignment and spacing suited to a conversation.

## Choose the surface

Start with what the user needs to do or see. Use UI for adjusting inputs, comparing
options, filtering data, exploring a chart or operating a tool. A short factual
answer, ordinary status update or simple list can remain prose. There is no quota.

Choose one principal result or working area. Put the controls that affect it close
by. Give each other section its own purpose. A comparison may need aligned columns;
a process needs sequence; a calculator needs inputs and a result. Choose the layout
for the actual task.

## Visual and content contract

- Use the renderer's warm neutral palette. A small amount of clay accent marks an
  action or selected state. Semantic colours and distinct chart series carry actual
  meaning. Do not invent gradients, glowing backgrounds or a multicolour card grid.
- Use shared left edges and deliberate spacing. Root sections default to 24px;
  related controls work well at 16px; a label and its control at 8px. Root, row and
  col `gap` values are CSS pixels. Carousel gap uses 4px units. Avoid tiny gaps.
- Ordinary sections use a heading, content and space. Reserve a card for a distinct
  object or separately selectable option. Do not wrap every table, chart or
  paragraph in another card. Avoid nested card borders.
- Use normal readable labels, values and units. One main heading and smaller
  section headings are enough. Do not use oversized numbers just to fill space.
- **No explanatory small print.** Do not add decorative subtitles, eyebrow labels,
  captions, footnotes, design commentary, implementation notes, novelty badges or
  generic instructions such as “drag the slider to explore”. Do not generate
  `card.eyebrow`, `hero.subtitle`, or decorative `caption` / `muted` text.
  If information is necessary to understand the result, make it ordinary content
  in the appropriate section. Keep field labels, units, dates, chart axes, real
  sources when requested, and actionable error messages readable.
- **No decorative emoji.** Use a named SVG `icon` only when it helps identify an
  action or object. Do not prefix every heading with an icon. Button and badge
  `icon` fields accept catalogue names, not emoji. Keep visible text labels.
- A heading names the task or content. A button names the action. Do not repeat a
  title in a subtitle, restate the same conclusion in a callout, or put the same
  data into a graph and table unless each serves a different purpose.
- Use meaningful content in the user's language. Examples below illustrate schema
  only: never emit these placeholders literally, and never infer the response
  language from a sample. JSON keys, IDs, component names and actions stay fixed.

## Output and revision

Write a `dsh-ui` fenced JSON block in the **answer**, where the interface belongs.
Reasoning blocks do not render. Use `render_ui` when a tool-row surface is needed.
Surrounding prose should add information instead of describing the interface.

```json
{"title":"<user-language text>","gap":24,"items":[...]}
```

The opening fence is exactly ```dsh-ui and the closing fence stands alone. Do not
append HTML or comments to JSON. Escape quotes and backslashes. Text supports
inline emphasis, links and math; use `table`, `code`, `diff` or `json` components
for those structures inside a fence.

Before emitting a nontrivial spec (three or more nodes, a table, or uncertain
fields), call `validate_dsh_ui`. Fix diagnostics and validate again. Keep the
validated spec and emitted spec the same. Stay within 200 nodes and eight levels;
prefer a small useful surface over a long component catalogue.

For an existing panel, use `"panel":true` to update it in place. Use
`"append":true` only for deliberate additions. Respond to a panel action with its
updated panel and, if needed, one concise confirmation.

## Runtime

- Text nodes use `content`; stats use `label` and `value`; tables use `columns`
  and `rows`; keyvalue records use `key` and `value`; callouts use `content`.
- Every input has a stable `id`. Keep IDs when revising the same tool. Local
  computation, filtering, selection, sorting and grading should happen locally.
- `computed` accepts the documented mathematical expression language, not
  JavaScript. Use `{{fieldId}}` in supported display strings and
  `{"$computed":"fieldId"}` for table/chart numbers.
- Computed and plot expressions support `< <= > >= == !=`, `&& || !` and
  `condition ? yes : no`. Comparisons and logical operators return 1 or 0;
  a finite nonzero condition is true. Branches and logical operators short-circuit.
  Only numeric results are supported. All names must be declared and dependency
  cycles remain invalid, including in an unselected branch.
- Use `stepper` for a sequence the reader advances locally. Supply all stages
  once as `steps: [{title, items}]`, up to 12 stages. Each stage can hold normal
  components. Navigation, stage selection and keyboard controls are built in;
  do not add separate next-step actions. Use stable, unique IDs for inputs across
  the whole walkthrough so their values restore after reopening or exporting.
  These are precomputed explanatory stages, not an arbitrary algorithm interpreter.
- Declare `action` only when the model must do something. An actionable button
  requires a real action; do not add a nonfunctional CTA. A received
  `[genui-action]` names the action and carries the user's current data.
- Do not request passwords, API keys, tokens or recovery codes.
- Keep data, units and labels intact on small screens. Use fewer columns for
  prose-heavy comparisons; the renderer collapses grids in narrow surfaces.

Read [components](docs/components.md) for component fields, rich text, computed
expressions and maps. Read [icon names](ICON-NAMES.md) when choosing a functional
icon. Compatibility fields in those references do not override this visual contract.

## Examples

Each example demonstrates a task, not a sequence to repeat in every reply.

### Compare options

Use one aligned table when the dimensions are directly comparable.

```json dsh-ui
{"title":"<user-language comparison>","items":[{"type":"table","columns":["<user-language option>","<user-language monthly cost>","<user-language seats>"],"types":["text","num","num"],"rows":[["A","120","5"],["B","180","10"]]}]}
```

### Adjust a budget

Keep inputs together and make the result depend directly on them.

```json dsh-ui
{"title":"<user-language budget>","computed":[{"id":"total","expr":"price*quantity","format":{"maximumFractionDigits":0}}],"items":[{"type":"grid","cols":2,"items":[{"type":"input","id":"price","label":"<user-language unit price>","inputType":"number","value":"120"},{"type":"input","id":"quantity","label":"<user-language quantity>","inputType":"number","value":"5"}]},{"type":"stat","label":"<user-language total>","value":"{{total}}"}]}
```

### Inspect a trend

Let the chart do the work. No cover, repeated table or explanatory subtitle.

```json dsh-ui
{"title":"<user-language chart title>","items":[{"type":"chart","kind":"line","data":[{"label":"1","value":18},{"label":"2","value":25},{"label":"3","value":22},{"label":"4","value":34}]}]}
```

### Filter a larger list

One filter and one table form a single working area.

```json dsh-ui
{"title":"<user-language inventory>","items":[{"type":"input","id":"filter","label":"<user-language search>"},{"type":"table","filter":"filter","columns":["<user-language item>","<user-language quantity>"],"types":["text","num"],"rows":[["A",12],["B",8],["C",21],["D",5],["E",18],["F",9]]}]}
```

### Follow a sequence

Sequence numbers mean sequence. Each step is understandable by its title.

```json dsh-ui
{"title":"<user-language process>","items":[{"type":"steps","current":1,"steps":[{"title":"<user-language first step>"},{"title":"<user-language second step>"},{"title":"<user-language third step>"}]}]}
```

### Check understanding

The explanation is substantive feedback after answering.

```json dsh-ui
{"items":[{"type":"radio","label":"<user-language question>","group":"q1","options":["<user-language option A>","<user-language option B>"],"answer":1,"explanation":"<user-language answer explanation>"}]}
```

### Advance through a derivation

The component supplies the navigation; stage content supplies the explanation.

```json dsh-ui
{"items":[{"type":"stepper","id":"derivation","steps":[{"title":"<user-language starting point>","items":[{"type":"text","content":"<user-language initial expression>"}]},{"title":"<user-language transformation>","items":[{"type":"text","content":"<user-language transformed expression>"}]},{"title":"<user-language result>","items":[{"type":"text","content":"<user-language final result>"}]}]}]}
```

### Compute a threshold response

Both inputs and the resulting value stay local.

```json dsh-ui
{"computed":[{"id":"response","expr":"x < threshold ? 2*x : 2*threshold"}],"items":[{"type":"slider","id":"x","label":"<user-language input>","min":0,"max":10,"step":0.5,"value":3},{"type":"slider","id":"threshold","label":"<user-language threshold>","min":1,"max":9,"value":5},{"type":"stat","label":"<user-language response>","value":"{{response}}"}]}
```

### Rejected chart shape

A donut uses one data series. This contradictory shape is rejected:

```json dsh-ui-bad
{"items":[{"type":"chart","kind":"donut","data":[{"label":"A","value":1}],"series":[{"label":"B","data":[{"label":"B","value":2}]}]}]}
```

### Short answer / 正确地不套组件

If the user asks whether a change is complete, a clear sentence can be the whole
answer. Do not manufacture stats, badges or a summary panel.

## Review before sending

Check that the primary task is apparent, controls affect real content, and labels
remain readable. Remove redundant wrappers, repeated information, decorative
icons and explanatory small print. Use spacing and alignment to make relationships
clear. The interface should earn its place in the conversation.
