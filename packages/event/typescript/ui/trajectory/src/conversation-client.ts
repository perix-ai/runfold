/**
 * Standalone ESM surface for the exact upstream conversation pieces used by
 * Trajectory. The upstream published `client.js` targets its browser ModuleLoader,
 * so the extraction re-exports the unchanged source modules directly.
 */
export { ConversationNodeAssembler } from '../../../packages/client/ui-conversation/src/client/conversation/assembler.ts'
export { inspectRequestPrompt } from '../../../packages/client/ui-conversation/src/client/contract/request-inspection.ts'
