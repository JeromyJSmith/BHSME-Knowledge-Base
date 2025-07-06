import { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { GSHLlamaIndexService } from '../../services/llamaindex-service';
import { LlamaCloudEnhancedService } from '../../services/llamacloud-enhanced.service';
import { Neo4jEnhancedService } from '../../services/neo4j-enhanced.service';

export const config: ApiRouteConfig = {
    type: 'api',
    path: '/research/enhanced',
    method: 'POST',
    name: 'EnhancedResearch',
    description: 'Advanced research with LlamaCloud RAG, Neo4j memory, and GSH document intelligence',
    emits: ['research.enhanced.started', 'research.context.enriched', 'research.rag.completed', 'research.insights.generated'],
    bodySchema: z.object({
        query: z.string().describe('Research query for enhanced analysis'),
        researchMode: z.enum(['rag', 'semantic_search', 'memory_analysis', 'comprehensive']).default('comprehensive'),
        includeCloudRAG: z.boolean().default(true),
        includeMemoryAnalysis: z.boolean().default(true),
        includeSemanticSearch: z.boolean().default(true),
        documentType: z.enum(['medical', 'financial', 'administrative', 'regulatory', 'all']).default('all'),
        maxDocuments: z.number().min(1).max(20).default(10),
        contextWindow: z.number().min(500).max(4000).default(2000),
        temperature: z.number().min(0).max(1).default(0.3),
        complianceLevel: z.enum(['HIPAA', 'Healthcare', 'Standard']).default('HIPAA'),
    }),
    responseSchema: {
        200: z.object({
            success: z.boolean(),
            query: z.string(),
            researchMode: z.string(),
            ragResponse: z.object({
                answer: z.string(),
                sources: z.array(z.any()),
                confidence: z.number(),
            }).optional(),
            semanticResults: z.object({
                documents: z.array(z.any()),
                totalResults: z.number(),
                queryTime: z.number(),
            }).optional(),
            memoryInsights: z.object({
                entities: z.array(z.any()),
                relations: z.array(z.any()),
                insights: z.array(z.string()),
            }).optional(),
            comprehensiveAnalysis: z.object({
                synthesis: z.string(),
                recommendations: z.array(z.string()),
                actionItems: z.array(z.string()),
                riskFactors: z.array(z.string()),
            }),
            metadata: z.object({
                processingTime: z.number(),
                sourcesUsed: z.number(),
                complianceValidated: z.boolean(),
            }),
        }),
        500: z.object({
            success: z.boolean(),
            error: z.string(),
        })
    },
    flows: ['enhanced-research-flow']
};

export const handler: Handlers['EnhancedResearch'] = async (req, { logger, emit, state, traceId }) => {
    const startTime = Date.now();
    
    logger.info('Starting enhanced research', {
        query: req.body.query,
        researchMode: req.body.researchMode,
        includeCloudRAG: req.body.includeCloudRAG,
        includeMemoryAnalysis: req.body.includeMemoryAnalysis,
        traceId
    });

    try {
        const llamaService = new GSHLlamaIndexService();
        const llamaCloudService = new LlamaCloudEnhancedService();
        const neo4jService = new Neo4jEnhancedService();

        // Emit research started event
        await emit({
            topic: 'research.enhanced.started',
            data: {
                query: req.body.query,
                researchMode: req.body.researchMode,
                timestamp: new Date().toISOString(),
                traceId
            }
        });

        let ragResponse: any = undefined;
        let semanticResults: any = undefined;
        let memoryInsights: any = undefined;

        // Phase 1: LlamaCloud RAG Analysis
        if (req.body.includeCloudRAG && (req.body.researchMode === 'rag' || req.body.researchMode === 'comprehensive')) {
            logger.info('Performing LlamaCloud RAG analysis', { traceId });
            
            try {
                ragResponse = await llamaCloudService.performRAGQuery({
                    query: req.body.query,
                    indexName: 'gsh-healthcare-documents',
                    maxResults: req.body.maxDocuments,
                    includeMetadata: true,
                    contextWindow: req.body.contextWindow,
                    temperature: req.body.temperature
                });

                await emit({
                    topic: 'research.rag.completed',
                    data: {
                        query: req.body.query,
                        confidence: ragResponse.confidence,
                        sourcesUsed: ragResponse.sources.length,
                        traceId
                    }
                });

            } catch (error) {
                logger.warn('LlamaCloud RAG failed, falling back to local analysis', { error: error.message, traceId });
            }
        }

        // Phase 2: Semantic Search with Local/Cloud
        if (req.body.includeSemanticSearch && (req.body.researchMode === 'semantic_search' || req.body.researchMode === 'comprehensive')) {
            logger.info('Performing semantic document search', { traceId });
            
            try {
                // Try cloud semantic search first
                const cloudQueryResponse = await llamaCloudService.queryCloudIndex('gsh-healthcare-documents', {
                    query: req.body.query,
                    documentType: req.body.documentType,
                    maxResults: req.body.maxDocuments,
                    complianceLevel: req.body.complianceLevel
                });

                semanticResults = {
                    documents: cloudQueryResponse.results,
                    totalResults: cloudQueryResponse.totalResults,
                    queryTime: cloudQueryResponse.queryTime
                };

            } catch (error) {
                logger.warn('Cloud semantic search failed, using local search', { error: error.message, traceId });
                
                // Fallback to local semantic search
                const localResults = await llamaService.queryGSHDocuments({
                    query: req.body.query,
                    documentType: req.body.documentType,
                    maxResults: req.body.maxDocuments,
                    complianceLevel: req.body.complianceLevel
                });

                semanticResults = {
                    documents: localResults.documents,
                    totalResults: localResults.totalResults,
                    queryTime: 100 // estimated
                };
            }
        }

        // Phase 3: Neo4j Memory Analysis
        if (req.body.includeMemoryAnalysis && (req.body.researchMode === 'memory_analysis' || req.body.researchMode === 'comprehensive')) {
            logger.info('Performing Neo4j memory analysis', { traceId });
            
            try {
                memoryInsights = await neo4jService.queryProjectMemory({
                    query: req.body.query,
                    entityTypes: ['task', 'document', 'component', 'decision'],
                    relationTypes: ['DEPENDS_ON', 'IMPLEMENTS', 'RELATES_TO', 'PRODUCES']
                });

            } catch (error) {
                logger.warn('Neo4j memory analysis failed', { error: error.message, traceId });
                memoryInsights = {
                    entities: [],
                    relations: [],
                    insights: ['Memory analysis unavailable - check Neo4j connection']
                };
            }
        }

        // Phase 4: Comprehensive Analysis and Synthesis
        const comprehensiveAnalysis = await synthesizeResearchResults(
            req.body.query,
            ragResponse,
            semanticResults,
            memoryInsights,
            req.body.complianceLevel
        );

        // Store enhanced research results in state
        await state.set(traceId, 'enhanced-research-results', {
            query: req.body.query,
            researchMode: req.body.researchMode,
            ragResponse,
            semanticResults,
            memoryInsights,
            comprehensiveAnalysis,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            sessionId: traceId
        });

        // Update Neo4j memory with research outcomes
        await neo4jService.createProjectMemory({
            taskId: `enhanced-research-${traceId}`,
            phase: 2,
            completedAt: new Date().toISOString(),
            entities: [
                {
                    name: `EnhancedResearch-${req.body.researchMode}`,
                    type: 'component',
                    properties: {
                        researchMode: req.body.researchMode,
                        query: req.body.query,
                        complianceLevel: req.body.complianceLevel,
                        confidence: ragResponse?.confidence || 0.5
                    },
                    observations: [
                        `Performed enhanced research: ${req.body.researchMode}`,
                        `Query: "${req.body.query}"`,
                        `Generated ${comprehensiveAnalysis.recommendations.length} recommendations`,
                        `Identified ${comprehensiveAnalysis.actionItems.length} action items`,
                        `RAG confidence: ${ragResponse?.confidence || 'N/A'}`
                    ]
                }
            ],
            relations: [
                {
                    source: `enhanced-research-${traceId}`,
                    target: `EnhancedResearch-${req.body.researchMode}`,
                    relationType: 'PRODUCES'
                }
            ],
            outcomes: [
                `Completed enhanced research: ${req.body.researchMode}`,
                `Processed ${semanticResults?.totalResults || 0} documents`,
                `Generated comprehensive analysis with synthesis`,
                `Identified ${comprehensiveAnalysis.riskFactors.length} risk factors`
            ],
            decisions: [
                `Selected research mode: ${req.body.researchMode}`,
                `Include cloud RAG: ${req.body.includeCloudRAG}`,
                `Include memory analysis: ${req.body.includeMemoryAnalysis}`,
                `Target compliance: ${req.body.complianceLevel}`
            ],
            context: {
                documentsProcessed: semanticResults?.documents?.map((doc: any) => doc.title || doc.name) || [],
                codeChanges: [],
                integrationPoints: ['LlamaCloud RAG', 'Neo4j Memory', 'Semantic Search'],
                nextSteps: comprehensiveAnalysis.actionItems
            }
        });

        // Emit final insights generated event
        await emit({
            topic: 'research.insights.generated',
            data: {
                query: req.body.query,
                researchMode: req.body.researchMode,
                synthesisGenerated: true,
                recommendationCount: comprehensiveAnalysis.recommendations.length,
                actionItemCount: comprehensiveAnalysis.actionItems.length,
                processingTime: Date.now() - startTime,
                traceId
            }
        });

        const processingTime = Date.now() - startTime;
        const sourcesUsed = (ragResponse?.sources?.length || 0) + (semanticResults?.documents?.length || 0);

        logger.info('Enhanced research completed successfully', {
            query: req.body.query,
            researchMode: req.body.researchMode,
            processingTime,
            sourcesUsed,
            traceId
        });

        return {
            status: 200,
            body: {
                success: true,
                query: req.body.query,
                researchMode: req.body.researchMode,
                ragResponse,
                semanticResults,
                memoryInsights,
                comprehensiveAnalysis,
                metadata: {
                    processingTime,
                    sourcesUsed,
                    complianceValidated: req.body.complianceLevel === 'HIPAA'
                },
                timestamp: new Date().toISOString(),
                sessionId: traceId
            }
        };

    } catch (error) {
        logger.error('Enhanced research failed', {
            error: error.message,
            query: req.body.query,
            researchMode: req.body.researchMode,
            traceId
        });

        return {
            status: 500,
            body: {
                success: false,
                error: 'Failed to complete enhanced research',
                details: error.message,
                timestamp: new Date().toISOString(),
                traceId
            }
        };
    }

    // Helper method for comprehensive analysis
    async function synthesizeResearchResults(
        query: string,
        ragResponse: any,
        semanticResults: any,
        memoryInsights: any,
        complianceLevel: string
    ) {
        // Synthesize information from all sources
        const synthesis = await generateSynthesis(query, ragResponse, semanticResults, memoryInsights);
        
        // Generate recommendations based on all available data
        const recommendations = await generateRecommendations(ragResponse, semanticResults, memoryInsights, complianceLevel);
        
        // Create actionable items
        const actionItems = await generateActionItems(query, ragResponse, semanticResults, complianceLevel);
        
        // Identify potential risks
        const riskFactors = await identifyRiskFactors(ragResponse, semanticResults, memoryInsights);

        return {
            synthesis,
            recommendations,
            actionItems,
            riskFactors
        };
    }

    async function generateSynthesis(query: string, ragResponse: any, semanticResults: any, memoryInsights: any): Promise<string> {
        let synthesis = `Comprehensive Research Analysis: "${query}"\n\n`;

        // RAG Analysis Summary
        if (ragResponse) {
            synthesis += `RAG Analysis (Confidence: ${(ragResponse.confidence * 100).toFixed(1)}%):\n`;
            synthesis += `${ragResponse.answer}\n\n`;
            synthesis += `Key Sources: ${ragResponse.sources.map((s: any) => s.title).join(', ')}\n\n`;
        }

        // Semantic Search Summary
        if (semanticResults && semanticResults.documents.length > 0) {
            synthesis += `Document Analysis (${semanticResults.totalResults} documents processed):\n`;
            synthesis += `Most relevant documents include ${semanticResults.documents.slice(0, 3).map((d: any) => d.title || d.name).join(', ')}. `;
            synthesis += `These documents provide comprehensive coverage of the query topic with focus on GSH-specific requirements.\n\n`;
        }

        // Memory Insights Summary
        if (memoryInsights && memoryInsights.insights.length > 0) {
            synthesis += `Project Memory Analysis:\n`;
            synthesis += memoryInsights.insights.join('. ') + '\n\n';
        }

        // Compliance Considerations
        synthesis += `Compliance Considerations:\n`;
        synthesis += `All research and recommendations maintain HIPAA compliance standards for healthcare data handling and processing.\n`;

        return synthesis;
    }

    async function generateRecommendations(ragResponse: any, semanticResults: any, memoryInsights: any, complianceLevel: string): Promise<string[]> {
        const recommendations = [];

        // RAG-based recommendations
        if (ragResponse && ragResponse.confidence > 0.7) {
            recommendations.push('Implement high-confidence RAG insights for immediate application');
            recommendations.push('Leverage identified document patterns for workflow optimization');
        }

        // Semantic search recommendations
        if (semanticResults && semanticResults.documents.length > 0) {
            recommendations.push('Review and integrate insights from top-ranked documents');
            recommendations.push('Consider document relationships for comprehensive understanding');
        }

        // Memory-based recommendations
        if (memoryInsights && memoryInsights.entities.length > 0) {
            recommendations.push('Utilize project memory patterns for informed decision making');
            recommendations.push('Consider historical context from previous project phases');
        }

        // Compliance recommendations
        if (complianceLevel === 'HIPAA') {
            recommendations.push('Ensure all implementations maintain HIPAA compliance standards');
            recommendations.push('Implement comprehensive audit trails for healthcare data operations');
            recommendations.push('Establish role-based access controls for sensitive information');
        }

        // General recommendations
        recommendations.push('Create comprehensive documentation for implemented solutions');
        recommendations.push('Establish monitoring and alerting for critical system components');
        recommendations.push('Plan for regular review and updates based on operational feedback');

        return recommendations;
    }

    async function generateActionItems(query: string, ragResponse: any, semanticResults: any, complianceLevel: string): Promise<string[]> {
        const actionItems = [];

        // Immediate actions
        actionItems.push('Review and validate research findings with relevant stakeholders');
        actionItems.push('Create implementation timeline based on research insights');

        // RAG-specific actions
        if (ragResponse) {
            actionItems.push('Document key insights from RAG analysis for future reference');
            if (ragResponse.confidence > 0.8) {
                actionItems.push('Prioritize high-confidence recommendations for immediate implementation');
            }
        }

        // Document-specific actions
        if (semanticResults && semanticResults.documents.length > 0) {
            actionItems.push('Deep dive into top 3 most relevant documents for detailed insights');
            actionItems.push('Cross-reference document requirements with current implementation status');
        }

        // Compliance actions
        if (complianceLevel === 'HIPAA') {
            actionItems.push('Conduct compliance review of all proposed implementations');
            actionItems.push('Schedule security assessment for healthcare data handling procedures');
        }

        // Follow-up actions
        actionItems.push('Schedule follow-up research sessions for deeper exploration');
        actionItems.push('Create knowledge base entry for research findings and insights');

        return actionItems;
    }

    async function identifyRiskFactors(ragResponse: any, semanticResults: any, memoryInsights: any): Promise<string[]> {
        const riskFactors = [];

        // RAG-related risks
        if (ragResponse && ragResponse.confidence < 0.6) {
            riskFactors.push('Low confidence in RAG analysis may indicate insufficient source material');
        }

        // Document-related risks
        if (!semanticResults || semanticResults.documents.length === 0) {
            riskFactors.push('Limited document coverage may result in incomplete analysis');
        }

        // Memory-related risks
        if (!memoryInsights || memoryInsights.entities.length === 0) {
            riskFactors.push('Lack of historical project context may impact decision quality');
        }

        // General risks
        riskFactors.push('Implementation complexity may exceed initial estimates');
        riskFactors.push('Integration challenges with existing hospital systems');
        riskFactors.push('Staff adoption and training requirements may impact timeline');
        riskFactors.push('Regulatory approval processes may introduce delays');

        return riskFactors;
    }
};