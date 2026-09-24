/**
 * Shared tree tokens for canvas fallbacks.
 *
 * The CSS vars in main.css (--tree-connector / --tree-connector-node) are the source of truth
 * for rendered UI colors. These literal hex fallbacks are only used in the canvas drawing path
 * (TreeVisualizer.vue) when getComputedStyle cannot read CSS vars (e.g. test env, SSR).
 *
 * Keep these in sync with web/src/assets/main.css :root --tree-connector* tokens.
 */
export const TREE_CONNECTOR_COLOR = '#93C5FD';
export const TREE_CONNECTOR_NODE_COLOR = '#3B82F6';
