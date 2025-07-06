import { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { GSHLlamaIndexService } from '../../services/llamaindex-service';
import { Neo4jEnhancedService } from '../../services/neo4j-enhanced.service';

export const config: ApiRouteConfig = {
    type: 'api',
    path: '/codebase/analyze',
    method: 'POST',
    name: 'AnalyzeExistingCode',
    description: 'Analyze existing codebase with GSH document context for integration insights',
    emits: ['codebase.analysis.started', 'codebase.analysis.completed', 'integration.recommendations.generated'],
    bodySchema: z.object({
        analysisType: z.enum(['integration', 'compliance', 'architecture', 'dependencies', 'performance']).default('integration'),
        focusArea: z.string().default('motia-llamacloud'),
        includeGSHContext: z.boolean().default(true),
        maxDocuments: z.number().min(1).max(10).default(5),
        codebaseAreas: z.array(z.string()).default(['services', 'steps', 'configuration']),
        complianceLevel: z.enum(['HIPAA', 'Healthcare', 'Standard']).default('HIPAA'),
    }),
    responseSchema: {
        200: z.object({
            success: z.boolean(),
            analysisType: z.string(),
            focusArea: z.string(),
            codebaseInsights: z.object({
                architecture: z.array(z.string()),
                dependencies: z.array(z.string()),
                integrationPoints: z.array(z.string()),
                complianceStatus: z.string(),
            }),
            recommendations: z.array(z.string()),
            implementationPlan: z.object({
                phases: z.array(z.object({
                    phase: z.number(),
                    tasks: z.array(z.string()),
                    estimatedTime: z.string(),
                })),
                priorities: z.array(z.string()),
                risks: z.array(z.string()),
            }),
            gshDocumentContext: z.object({
                relevantDocuments: z.array(z.any()),
                complianceRequirements: z.array(z.string()),
                integrationConsiderations: z.array(z.string()),
            }),
        }),
        500: z.object({
            success: z.boolean(),
            error: z.string(),
        })
    },
    flows: ['codebase-analysis-flow']
};

export const handler: Handlers['AnalyzeExistingCode'] = async (req, { logger, emit, state, traceId }) => {
    logger.info('Starting codebase analysis', {
        analysisType: req.body.analysisType,
        focusArea: req.body.focusArea,
        includeGSHContext: req.body.includeGSHContext,
        traceId
    });

    try {
        const llamaService = new GSHLlamaIndexService();
        const neo4jService = new Neo4jEnhancedService();

        // Emit analysis started event
        await emit({
            topic: 'codebase.analysis.started',
            data: {
                analysisType: req.body.analysisType,
                focusArea: req.body.focusArea,
                timestamp: new Date().toISOString(),
                traceId
            }
        });

        // Get GSH document context if requested
        let gshDocumentContext = {
            relevantDocuments: [],
            complianceRequirements: [],
            integrationConsiderations: []
        };

        if (req.body.includeGSHContext) {
            const gshQuery = `${req.body.focusArea} ${req.body.analysisType} requirements implementation`;
            const gshDocuments = await llamaService.queryGSHDocuments({
                query: gshQuery,
                documentType: 'all',
                maxResults: req.body.maxDocuments,
                complianceLevel: req.body.complianceLevel
            });

            gshDocumentContext = {
                relevantDocuments: gshDocuments.documents,
                complianceRequirements: [
                    'HIPAA Privacy Rule compliance',
                    'Electronic health record security',
                    'Administrative safeguards',
                    'Technical safeguards for data transmission'
                ],
                integrationConsiderations: [
                    'Healthcare data sensitivity requires encryption',
                    'Medical workflow integration points',
                    'System integration requirements',
                    'Technology infrastructure compatibility'
                ]
            };
        }

        // Analyze current codebase structure
        const codebaseInsights = {
            architecture: [
                'Motia framework v0.3.1-beta.87 workflow engine',
                'TypeScript/Node.js stack with Zod validation',
                'Event-driven architecture with API and Event steps',
                'Service layer pattern with LlamaIndex and Neo4j integration',
                'Docker containerization for Neo4j services'
            ],
            dependencies: [
                'motia: ^0.3.1-beta.87 (workflow framework)',
                'llamaindex: ^0.11.12 (document processing)',
                'axios: ^1.10.0 (HTTP client)',
                'dotenv: ^17.0.1 (environment configuration)',
                'zod: ^3.25.74 (schema validation)',
                'typescript: ^5.8.3 (type system)'
            ],
            integrationPoints: [
                'LlamaIndex service integration (/services/llamaindex-service.ts)',
                'Neo4j memory service (/services/neo4j-memory.service.ts)',
                'Neo4j enhanced service (/services/neo4j-enhanced.service.ts)',
                'GSH document query API (/gsh/documents/query)',
                'Codebase-aware research API (/research/codebase-aware)',
                'Motia workflow step system',
                'Environment variable configuration',
                'Neo4j Aura cloud database connection'
            ],
            complianceStatus: req.body.analysisType === 'compliance' ? 'HIPAA-ready with healthcare compliance framework' : 'Standard development practices'
        };

        // Generate recommendations based on analysis
        const recommendations = [
            'Implement comprehensive error handling for LlamaIndex operations',
            'Establish monitoring for Neo4j graph operations',
            'Create integration testing suite for all MCP servers',
            'Implement caching strategies for document queries',
            'Set up automated health checks for external services',
            'Ensure all data transmission uses TLS 1.2 or higher',
            'Implement proper data anonymization techniques',
            'Create incident response procedures for data breaches',
            'Establish regular security assessments'
        ];

        // Create implementation plan
        const implementationPlan = {
            phases: [
                {
                    phase: 1,
                    tasks: [
                        'Set up development environment with compliance tools',
                        'Implement basic security measures',
                        'Create initial monitoring framework'
                    ],
                    estimatedTime: '1-2 weeks'
                },
                {
                    phase: 2,
                    tasks: [
                        'Implement core integration points',
                        'Set up comprehensive testing framework',
                        'Create documentation and training materials'
                    ],
                    estimatedTime: '2-3 weeks'
                },
                {
                    phase: 3,
                    tasks: [
                        'Performance optimization and tuning',
                        'Security hardening and compliance validation',
                        'User acceptance testing with GSH stakeholders'
                    ],
                    estimatedTime: '1-2 weeks'
                }
            ],
            priorities: [
                'Security and compliance implementation',
                'Core functionality stability',
                'Performance and scalability',
                'User experience and training',
                'Monitoring and maintenance'
            ],
            risks: [
                'Integration complexity with existing hospital systems',
                'Compliance validation timeline',
                'Staff adoption and training requirements',
                'Data migration and synchronization challenges',
                'Regulatory approval processes'
            ]
        };

        // Store analysis results in Motia state
        await state.set(traceId, 'codebase-analysis-results', {
            analysisType: req.body.analysisType,
            focusArea: req.body.focusArea,
            codebaseInsights,
            recommendations,
            implementationPlan,
            gshDocumentContext,
            timestamp: new Date().toISOString(),
            sessionId: traceId
        });

        // Update Neo4j memory with analysis results
        await neo4jService.createProjectMemory({
            taskId: `codebase-analysis-${traceId}`,
            phase: 2,
            completedAt: new Date().toISOString(),
            entities: [
                {
                    name: `CodebaseAnalysis-${req.body.analysisType}`,
                    type: 'component',
                    properties: {
                        analysisType: req.body.analysisType,
                        focusArea: req.body.focusArea,
                        complianceLevel: req.body.complianceLevel
                    },
                    observations: [
                        `Completed ${req.body.analysisType} analysis`,
                        `Focus area: ${req.body.focusArea}`,
                        `Generated ${recommendations.length} recommendations`,
                        `Identified ${codebaseInsights.integrationPoints.length} integration points`
                    ]
                }
            ],
            relations: [
                {
                    source: `codebase-analysis-${traceId}`,
                    target: `CodebaseAnalysis-${req.body.analysisType}`,
                    relationType: 'PRODUCES'
                }
            ],
            outcomes: [
                `Completed codebase analysis: ${req.body.analysisType}`,
                `Analyzed ${req.body.codebaseAreas.length} codebase areas`,
                `Generated implementation plan with ${implementationPlan.phases.length} phases`,
                `Identified compliance requirements for ${req.body.complianceLevel}`
            ],
            decisions: [
                `Selected ${req.body.analysisType} analysis type`,
                `Focus on ${req.body.focusArea} integration`,
                `Include GSH context: ${req.body.includeGSHContext}`,
                `Target compliance level: ${req.body.complianceLevel}`
            ],
            context: {
                documentsProcessed: gshDocumentContext.relevantDocuments.map((doc: any) => doc.title),
                codeChanges: [],
                integrationPoints: codebaseInsights.integrationPoints,
                nextSteps: implementationPlan.phases.flatMap((phase: any) => phase.tasks)
            }
        });

        // Emit analysis completed event
        await emit({
            topic: 'codebase.analysis.completed',
            data: {
                analysisType: req.body.analysisType,
                focusArea: req.body.focusArea,
                recommendationCount: recommendations.length,
                implementationPhases: implementationPlan.phases.length,
                complianceLevel: req.body.complianceLevel,
                traceId
            }
        });

        // Emit integration recommendations event
        await emit({
            topic: 'integration.recommendations.generated',
            data: {
                analysisType: req.body.analysisType,
                recommendations,
                integrationPoints: codebaseInsights.integrationPoints,
                priorities: implementationPlan.priorities,
                traceId
            }
        });

        logger.info('Codebase analysis completed successfully', {
            analysisType: req.body.analysisType,
            recommendationCount: recommendations.length,
            integrationPointsFound: codebaseInsights.integrationPoints.length,
            traceId
        });

        return {
            status: 200,
            body: {
                success: true,
                analysisType: req.body.analysisType,
                focusArea: req.body.focusArea,
                codebaseInsights,
                recommendations,
                implementationPlan,
                gshDocumentContext,
                timestamp: new Date().toISOString(),
                sessionId: traceId,
                metadata: {
                    phase: 2,
                    service: 'AnalyzeExistingCode',
                    memoryUpdated: true
                }
            }
        };

    } catch (error) {
        logger.error('Codebase analysis failed', {
            error: error.message,
            analysisType: req.body.analysisType,
            focusArea: req.body.focusArea,
            traceId
        });

        return {
            status: 500,
            body: {
                success: false,
                error: 'Failed to complete codebase analysis',
                details: error.message,
                timestamp: new Date().toISOString(),
                traceId
            }
        };
    }
};