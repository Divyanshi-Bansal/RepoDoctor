/**
 * Valid system component types. Matches the canonical schema in system_architecture.md.
 */
export enum NodeType {
  SERVICE = 'SERVICE',
  DATABASE = 'DATABASE',
  QUEUE = 'QUEUE',
  ENDPOINT = 'ENDPOINT',
  PACKAGE = 'PACKAGE',
}

/**
 * Valid dependency relationship types. Matches the canonical schema in system_architecture.md.
 */
export enum EdgeType {
  CALLS = 'CALLS',
  READS_FROM = 'READS_FROM',
  WRITES_TO = 'WRITES_TO',
  CONSUMES = 'CONSUMES',
  PRODUCES = 'PRODUCES',
  DEPENDS_ON = 'DEPENDS_ON',
}
