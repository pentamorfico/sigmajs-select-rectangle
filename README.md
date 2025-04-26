# sigmajs-select-rectangle

A reusable rectangular selection tool for [Sigma.js](https://github.com/jacomyal/sigma.js) v3+.

## Features

- Shift+drag to create a selection rectangle
- Select nodes that intersect with the selection rectangle
- Customizable appearance and behavior
- Callbacks for selection events

## Installation

```bash
npm install sigmajs-select-rectangle
```

## Usage

```js
import SigmaSelectionTool from "sigmajs-select-rectangle";

SigmaSelectionTool(renderer, {
  borderStyle: "2px dashed #fff",
  background: "rgba(100, 100, 255, 0.1)",
  onSelectionComplete: (nodes) => {
    // Highlight selected nodes in white, others by community
    graph.forEachNode((node) => {
      graph.setNodeAttribute(
        node,
        "color",
        nodes.includes(node)
          ? "#fff"
          : palette[graph.getNodeAttribute(node, "community")]
      );
    });
  },
});
```

## API

### SigmaSelectionTool(renderer, settings)

- `renderer`: Sigma.js renderer instance
- `settings`: (optional) Object to override default settings

#### Settings options
- `borderStyle`, `background`, `zIndex`, `modifierKey`, `selectOnlyComplete`, `nodeSizeMultiplier`, `selectOnRelease`, `performanceMode`, `throttleUpdates`, `onSelectionStart`, `onSelectionChange`, `onSelectionComplete`

## Acknowledgements

This package is based on the original selection tool from [Yomguithereal/sigma-experiments](https://github.com/Yomguithereal/sigma-experiments/tree/master/selection-tool), adapted for Sigma.js v3+.

## License

MIT
