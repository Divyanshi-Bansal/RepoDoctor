import { Injectable, Logger } from '@nestjs/common';
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { NodeType, EdgeType } from '../graph-engine/entities/graph.enums.js';

export interface ExtractedEvidence {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
}

export interface ExtractedNode {
  identifier: string; // Relative file path, e.g. "src/auth/auth.service.ts"
  displayName: string;
  nodeType: NodeType;
  metadata: Record<string, unknown>;
  evidence: ExtractedEvidence;
}

export interface ExtractedEdge {
  sourceIdentifier: string;
  targetIdentifier: string;
  edgeType: EdgeType;
  confidence: number;
  isInferred: boolean;
  evidence: ExtractedEvidence;
}

export interface AnalysisOutput {
  nodes: ExtractedNode[];
  edges: ExtractedEdge[];
}

interface SymbolMapping {
  readonly targetFile: string;
  readonly isTypeOnly: boolean;
}

interface InjectedPropertyMapping {
  readonly targetFile: string;
  readonly isDatabase: boolean;
  readonly isQueue: boolean;
}

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  /**
   * Resolves an import module specifier relative to the importing file
   * against the set of all known files in the analyzed repository.
   */
  resolveImportTarget(
    importerPath: string,
    specifier: string,
    knownFiles: Set<string>,
  ): string | null {
    if (!specifier.startsWith('.')) {
      // Third-party external package (npm, node built-in, etc.)
      return null;
    }

    const importerDir = path.dirname(importerPath);
    const rawTarget = path.normalize(path.join(importerDir, specifier));

    const candidates = [
      rawTarget,
      rawTarget + '.ts',
      rawTarget + '.tsx',
      rawTarget + '.js',
      rawTarget + '.jsx',
      rawTarget.replace(/\.js$/, '.ts'),
      rawTarget.replace(/\.jsx$/, '.tsx'),
      path.join(rawTarget, 'index.ts'),
      path.join(rawTarget, 'index.js'),
    ];

    for (const candidate of candidates) {
      // Normalize slashes to forward slashes for cross-platform stability
      const normalized = candidate.replace(/\\/g, '/');
      if (knownFiles.has(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * Classifies the architectural component type based on file path and declaration names.
   */
  classifyNodeType(filePath: string, exports: string[]): NodeType {
    const lowerPath = filePath.toLowerCase();
    const allSymbols = exports.join(' ').toLowerCase();

    if (
      lowerPath.includes('database') ||
      lowerPath.includes('entity') ||
      lowerPath.includes('repo') ||
      lowerPath.includes('schema') ||
      lowerPath.includes('migration') ||
      allSymbols.includes('entity') ||
      allSymbols.includes('repository')
    ) {
      return NodeType.DATABASE;
    }

    if (
      lowerPath.includes('queue') ||
      lowerPath.includes('worker') ||
      lowerPath.includes('job') ||
      lowerPath.includes('event') ||
      allSymbols.includes('queue') ||
      allSymbols.includes('worker')
    ) {
      return NodeType.QUEUE;
    }

    if (
      lowerPath.includes('service') ||
      lowerPath.includes('controller') ||
      lowerPath.includes('api') ||
      lowerPath.includes('guard') ||
      lowerPath.includes('middleware') ||
      allSymbols.includes('service') ||
      allSymbols.includes('controller')
    ) {
      return NodeType.SERVICE;
    }

    return NodeType.PACKAGE;
  }

  /**
   * Statically parses TypeScript/JavaScript source files in the workspace directory
   * using TypeScript's AST compiler API.
   *
   * Extracts evidence-grounded relationships:
   * - CALLS: Statically resolved function and service method calls.
   * - READS_FROM: Database query operations (find, select, count, query).
   * - WRITES_TO: Database mutation operations (save, insert, update, delete).
   * - PRODUCES: Queue job additions and event emissions.
   * - CONSUMES: Queue processors and workers.
   * - DEPENDS_ON: Module imports and exports without explicit invocations.
   */
  async analyzeWorkspace(
    workspaceDir: string,
    relativeFiles: readonly string[],
  ): Promise<AnalysisOutput> {
    const normalizedFiles = new Set(
      relativeFiles.map((f) => f.replace(/\\/g, '/')),
    );

    const nodes: ExtractedNode[] = [];
    const allEdges: ExtractedEdge[] = [];

    // Pre-pass: read and create ASTs
    const fileAstMap = new Map<
      string,
      { code: string; lines: string[]; sourceFile: ts.SourceFile; nodeType: NodeType }
    >();

    for (const relFile of normalizedFiles) {
      const fullPath = path.join(workspaceDir, relFile);
      if (!fs.existsSync(fullPath)) continue;

      let code = '';
      try {
        code = await fs.promises.readFile(fullPath, 'utf8');
      } catch (err) {
        this.logger.warn(`Could not read ${relFile}: ${err}`);
        continue;
      }

      const sourceFile = ts.createSourceFile(
        relFile,
        code,
        ts.ScriptTarget.Latest,
        true,
      );

      const exportedNames: string[] = [];
      const lines = code.split('\n');

      sourceFile.forEachChild((astNode) => {
        if (ts.isClassDeclaration(astNode) && astNode.name) {
          exportedNames.push(astNode.name.text);
        } else if (ts.isFunctionDeclaration(astNode) && astNode.name) {
          exportedNames.push(astNode.name.text);
        } else if (ts.isInterfaceDeclaration(astNode)) {
          exportedNames.push(astNode.name.text);
        } else if (ts.isTypeAliasDeclaration(astNode)) {
          exportedNames.push(astNode.name.text);
        } else if (ts.isEnumDeclaration(astNode)) {
          exportedNames.push(astNode.name.text);
        }
      });

      const nodeType = this.classifyNodeType(relFile, exportedNames);
      const isController =
        relFile.toLowerCase().includes('controller') ||
        relFile.toLowerCase().includes('route') ||
        exportedNames.some((e) => e.toLowerCase().includes('controller'));

      fileAstMap.set(relFile, { code, lines, sourceFile, nodeType });

      const nodeEvidenceLines = Math.min(25, lines.length);
      const nodeSnippet = lines.slice(0, nodeEvidenceLines).join('\n');

      nodes.push({
        identifier: relFile,
        displayName: path.basename(relFile),
        nodeType,
        metadata: {
          filePath: relFile,
          exports: exportedNames,
          lineCount: lines.length,
          kind: isController ? 'CONTROLLER' : nodeType,
        },
        evidence: {
          filePath: relFile,
          lineStart: 1,
          lineEnd: nodeEvidenceLines,
          codeSnippet: nodeSnippet,
        },
      });
    }

    // Second pass: extract granular AST relationships
    for (const relFile of normalizedFiles) {
      const fileData = fileAstMap.get(relFile);
      if (!fileData) continue;

      const { code, sourceFile } = fileData;
      const importedSymbols = new Map<string, SymbolMapping>();
      const injectedProperties = new Map<string, InjectedPropertyMapping>();
      const importedFiles = new Map<string, { startLine: number; endLine: number; snippet: string }>();

      // 1. Gather import declarations and map imported symbols to target files
      const visitImports = (astNode: ts.Node): void => {
        if (ts.isImportDeclaration(astNode) && ts.isStringLiteral(astNode.moduleSpecifier)) {
          const specifier = astNode.moduleSpecifier.text;
          const targetFile = this.resolveImportTarget(relFile, specifier, normalizedFiles);

          if (targetFile && targetFile !== relFile) {
            const startLoc = sourceFile.getLineAndCharacterOfPosition(astNode.getStart());
            const endLoc = sourceFile.getLineAndCharacterOfPosition(astNode.getEnd());
            const snippet = code.slice(astNode.getStart(), astNode.getEnd()).trim();

            if (!importedFiles.has(targetFile)) {
              importedFiles.set(targetFile, {
                startLine: startLoc.line + 1,
                endLine: endLoc.line + 1,
                snippet,
              });
            }

            const importClause = astNode.importClause;
            if (importClause) {
              // Default import: import Foo from './foo'
              if (importClause.name) {
                importedSymbols.set(importClause.name.text, { targetFile, isTypeOnly: false });
              }
              // Named imports: import { Foo, Bar as Baz } from './foo'
              if (importClause.namedBindings) {
                if (ts.isNamedImports(importClause.namedBindings)) {
                  for (const spec of importClause.namedBindings.elements) {
                    importedSymbols.set(spec.name.text, { targetFile, isTypeOnly: false });
                  }
                } else if (ts.isNamespaceImport(importClause.namedBindings)) {
                  // import * as Foo from './foo'
                  importedSymbols.set(importClause.namedBindings.name.text, { targetFile, isTypeOnly: false });
                }
              }
            }
          }
        }
        ts.forEachChild(astNode, visitImports);
      };

      visitImports(sourceFile);

      // Register verified module import dependencies first (in top-to-bottom source order)
      for (const [targetFile, importEvidence] of importedFiles.entries()) {
        allEdges.push({
          sourceIdentifier: relFile,
          targetIdentifier: targetFile,
          edgeType: EdgeType.DEPENDS_ON,
          confidence: 1.0,
          isInferred: false,
          evidence: {
            filePath: relFile,
            lineStart: importEvidence.startLine,
            lineEnd: importEvidence.endLine,
            codeSnippet: importEvidence.snippet,
          },
        });
      }

      // 2. Discover dependency injection in constructor parameters
      const visitConstructors = (astNode: ts.Node): void => {
        if (ts.isConstructorDeclaration(astNode)) {
          for (const param of astNode.parameters) {
            const paramName = param.name.getText(sourceFile);
            if (!param.type) continue;

            const typeText = param.type.getText(sourceFile);

            // Handle TypeORM Repository<UserEntity>
            if (typeText.includes('Repository<')) {
              const match = typeText.match(/Repository<([A-Za-z0-9_]+)>/);
              if (match && match[1]) {
                const entityName = match[1];
                const entityMapping = importedSymbols.get(entityName);
                if (entityMapping) {
                  injectedProperties.set(paramName, {
                    targetFile: entityMapping.targetFile,
                    isDatabase: true,
                    isQueue: false,
                  });
                  continue;
                }
              }
            }

            // Direct service injection: private readonly authService: AuthService
            const typeName = typeText.replace(/[^A-Za-z0-9_]/g, '');
            const mapping = importedSymbols.get(typeName);
            if (mapping) {
              const targetData = fileAstMap.get(mapping.targetFile);
              const isDb = targetData?.nodeType === NodeType.DATABASE || mapping.targetFile.toLowerCase().includes('entity');
              const isQueue = targetData?.nodeType === NodeType.QUEUE || mapping.targetFile.toLowerCase().includes('queue');

              injectedProperties.set(paramName, {
                targetFile: mapping.targetFile,
                isDatabase: isDb,
                isQueue,
              });
            }
          }
        }
        ts.forEachChild(astNode, visitConstructors);
      };

      visitConstructors(sourceFile);

      // 3. Inspect call expressions, method invocations, and queue operations
      const specificTargets = new Set<string>();

      const visitCallsAndOperations = (astNode: ts.Node): void => {
        let matchedTarget: string | null = null;
        let matchedEdgeType: EdgeType = EdgeType.CALLS;
        let matchedConfidence = 1.0;

        const getLocAndSnippet = (node: ts.Node) => {
          const startLoc = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const endLoc = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
          const snippet = code.slice(node.getStart(), node.getEnd()).trim();
          return {
            lineStart: startLoc.line + 1,
            lineEnd: endLoc.line + 1,
            codeSnippet: snippet,
          };
        };

        if (ts.isCallExpression(astNode)) {
          const expr = astNode.expression;

          // A) Property access call: this.authService.login(...) or this.userRepo.findOne(...)
          if (ts.isPropertyAccessExpression(expr)) {
            const methodName = expr.name.text.toLowerCase();
            const lhs = expr.expression;

            // Extract property identifier e.g. "this.authService" -> "authService"
            let propName = '';
            if (ts.isPropertyAccessExpression(lhs) && lhs.expression.kind === ts.SyntaxKind.ThisKeyword) {
              propName = lhs.name.text;
            } else if (ts.isIdentifier(lhs)) {
              propName = lhs.text;
            }

            const injected = injectedProperties.get(propName);
            const imported = importedSymbols.get(propName);
            const targetFile = injected?.targetFile || imported?.targetFile;

            if (targetFile) {
              matchedTarget = targetFile;
              const isDb = injected?.isDatabase || targetFile.toLowerCase().includes('entity') || targetFile.toLowerCase().includes('db');
              const isQueue = injected?.isQueue || targetFile.toLowerCase().includes('queue') || targetFile.toLowerCase().includes('worker');

              if (isDb) {
                if (['find', 'findone', 'findby', 'query', 'count', 'select', 'get'].some((m) => methodName.includes(m))) {
                  matchedEdgeType = EdgeType.READS_FROM;
                } else if (['save', 'insert', 'update', 'delete', 'remove', 'upsert', 'create'].some((m) => methodName.includes(m))) {
                  matchedEdgeType = EdgeType.WRITES_TO;
                } else {
                  matchedEdgeType = EdgeType.CALLS;
                }
              } else if (isQueue) {
                if (['add', 'produce', 'send', 'emit', 'enqueue'].some((m) => methodName.includes(m))) {
                  matchedEdgeType = EdgeType.PRODUCES;
                } else if (['process', 'consume', 'handle', 'on'].some((m) => methodName.includes(m))) {
                  matchedEdgeType = EdgeType.CONSUMES;
                } else {
                  matchedEdgeType = EdgeType.CALLS;
                }
              } else {
                matchedEdgeType = EdgeType.CALLS;
              }
            }
          }
          // B) Direct function call: validateToken(...)
          else if (ts.isIdentifier(expr)) {
            const funcName = expr.text;
            const imported = importedSymbols.get(funcName);
            if (imported) {
              matchedTarget = imported.targetFile;
              matchedEdgeType = EdgeType.CALLS;
            }
          }
        }
        // C) Instantiation: new UserService(...)
        else if (ts.isNewExpression(astNode) && ts.isIdentifier(astNode.expression)) {
          const clsName = astNode.expression.text;
          const imported = importedSymbols.get(clsName);
          if (imported) {
            matchedTarget = imported.targetFile;
            matchedEdgeType = EdgeType.CALLS;
          }
        }

        if (matchedTarget && matchedTarget !== relFile) {
          specificTargets.add(matchedTarget);
          const evidence = getLocAndSnippet(astNode);
          allEdges.push({
            sourceIdentifier: relFile,
            targetIdentifier: matchedTarget,
            edgeType: matchedEdgeType,
            confidence: matchedConfidence,
            isInferred: false,
            evidence: {
              filePath: relFile,
              lineStart: evidence.lineStart,
              lineEnd: evidence.lineEnd,
              codeSnippet: evidence.codeSnippet,
            },
          });
        }

        ts.forEachChild(astNode, visitCallsAndOperations);
      };

      visitCallsAndOperations(sourceFile);
    }

    // Deduplicate edges by source::target::edgeType
    const edgeMap = new Map<string, ExtractedEdge>();
    for (const edge of allEdges) {
      const key = `${edge.sourceIdentifier}::${edge.targetIdentifier}::${edge.edgeType}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, edge);
      }
    }

    return {
      nodes,
      edges: Array.from(edgeMap.values()),
    };
  }
}
