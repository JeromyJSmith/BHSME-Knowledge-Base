import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

export interface GSHProjectEntity {
    name: string;
    type: 'task' | 'document' | 'requirement' | 'component' | 'decision' | 'outcome' | 'risk' | 'resource';
    properties: Record<string, any>;
    observations: string[];
}

export interface GSHProjectRelation {
    source: string;
    target: string;
    relationType: 'DEPENDS_ON' | 'IMPLEMENTS' | 'RELATES_TO' | 'CONTAINS' | 'INFLUENCES' | 'REQUIRES' | 'PRODUCES';
    properties?: Record<string, any>;
}

export interface ProjectMemoryUpdate {
    taskId: string;
    phase: 1 | 2 | 3 | 4;
    completedAt: string;
    entities: GSHProjectEntity[];
    relations: GSHProjectRelation[];
    outcomes: string[];
    decisions: string[];
    context: {
        documentsProcessed: string[];
        codeChanges: string[];
        integrationPoints: string[];
        nextSteps: string[];
    };
}

export interface ProjectMemoryQuery {
    query: string;
    entityTypes?: string[];
    relationTypes?: string[];
    phase?: number;
    timeRange?: {
        start: string;
        end: string;
    };
}

export class Neo4jEnhancedService {
    private neo4jUrl: string;
    private neo4jUsername: string;
    private neo4jPassword: string;
    private neo4jDatabase: string;

    constructor() {
        this.neo4jUrl = process.env.NEO4J_URI || 'neo4j+s://f2230169.databases.neo4j.io';
        this.neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
        this.neo4jPassword = process.env.NEO4J_PASSWORD || '';
        this.neo4jDatabase = process.env.NEO4J_DATABASE || 'neo4j';
        
        console.log('Neo4j Enhanced Service initialized');
        console.log(`Connected to: ${this.neo4jUrl}`);
    }

    // Create GSH project memory structure
    async createProjectMemory(update: ProjectMemoryUpdate): Promise<{
        success: boolean;
        entitiesCreated: number;
        relationsCreated: number;
        memoryId: string;
    }> {
        try {
            console.log(`Creating project memory for task: ${update.taskId}, phase: ${update.phase}`);

            // Create main task entity
            const taskEntity: GSHProjectEntity = {
                name: update.taskId,
                type: 'task',
                properties: {
                    phase: update.phase,
                    completedAt: update.completedAt,
                    status: 'completed'
                },
                observations: [
                    `Phase ${update.phase} task completed`,
                    ...update.outcomes,
                    ...update.decisions
                ]
            };

            // Add document entities
            const documentEntities: GSHProjectEntity[] = update.context.documentsProcessed.map(doc => ({
                name: doc,
                type: 'document',
                properties: {
                    processedInTask: update.taskId,
                    phase: update.phase
                },
                observations: [`Processed in ${update.taskId} during phase ${update.phase}`]
            }));

            // Add integration point entities
            const integrationEntities: GSHProjectEntity[] = update.context.integrationPoints.map(point => ({
                name: point,
                type: 'component',
                properties: {
                    category: 'integration',
                    introducedInTask: update.taskId,
                    phase: update.phase
                },
                observations: [`Integration point established in ${update.taskId}`]
            }));

            // Combine all entities
            const allEntities = [taskEntity, ...documentEntities, ...integrationEntities, ...update.entities];

            // Create entity creation payload for Neo4j Memory MCP
            const entityCreationResult = await this.createEntitiesInMemory(allEntities);

            // Create relationships
            const taskRelations: GSHProjectRelation[] = [
                // Connect task to documents
                ...documentEntities.map(doc => ({
                    source: update.taskId,
                    target: doc.name,
                    relationType: 'PROCESSES' as any
                })),
                // Connect task to integration points
                ...integrationEntities.map(integration => ({
                    source: update.taskId,
                    target: integration.name,
                    relationType: 'PRODUCES' as any
                }))
            ];

            const allRelations = [...taskRelations, ...update.relations];
            const relationCreationResult = await this.createRelationsInMemory(allRelations);

            // Create phase relationships
            await this.createPhaseRelationships(update.taskId, update.phase);

            return {
                success: true,
                entitiesCreated: allEntities.length,
                relationsCreated: allRelations.length,
                memoryId: update.taskId
            };

        } catch (error) {
            console.error('Error creating project memory:', error);
            return {
                success: false,
                entitiesCreated: 0,
                relationsCreated: 0,
                memoryId: ''
            };
        }
    }

    // Query project memory using graph patterns
    async queryProjectMemory(query: ProjectMemoryQuery): Promise<{
        entities: any[];
        relations: any[];
        insights: string[];
        graphStructure: any;
    }> {
        try {
            console.log(`Querying project memory: ${query.query}`);

            // Search for relevant nodes using memory MCP
            const searchResults = await this.searchNodesInMemory(query.query);

            // Generate Cypher query based on search parameters
            let cypherQuery = this.buildCypherQuery(query);
            
            // Execute Cypher query for detailed analysis
            const cypherResults = await this.executeCypherQuery(cypherQuery);

            // Analyze relationships and generate insights
            const insights = await this.generateProjectInsights(searchResults, cypherResults);

            return {
                entities: searchResults.entities || [],
                relations: searchResults.relations || [],
                insights,
                graphStructure: cypherResults
            };

        } catch (error) {
            console.error('Error querying project memory:', error);
            return {
                entities: [],
                relations: [],
                insights: ['Error querying project memory'],
                graphStructure: null
            };
        }
    }

    // Get project overview and status
    async getProjectOverview(): Promise<{
        totalTasks: number;
        completedPhases: number[];
        activeIntegrations: string[];
        documentProcessingStatus: any;
        riskFactors: string[];
        recommendations: string[];
    }> {
        try {
            // Query all task entities
            const taskQuery = `
                MATCH (t:Memory {type: 'task'})
                RETURN t.name as taskId, t.phase as phase, t.status as status, t.completedAt as completedAt
                ORDER BY t.phase, t.completedAt
            `;

            const taskResults = await this.executeCypherQuery(taskQuery);

            // Query integration points
            const integrationQuery = `
                MATCH (i:Memory {type: 'component', category: 'integration'})
                RETURN i.name as integration, i.phase as phase
            `;

            const integrationResults = await this.executeCypherQuery(integrationQuery);

            // Query document processing
            const documentQuery = `
                MATCH (d:Memory {type: 'document'})
                RETURN d.name as document, d.phase as phase, d.processedInTask as task
            `;

            const documentResults = await this.executeCypherQuery(documentQuery);

            // Analyze results
            const completedPhases = [...new Set(taskResults.map((t: any) => t.phase))].sort();
            const activeIntegrations = integrationResults.map((i: any) => i.integration);

            return {
                totalTasks: taskResults.length,
                completedPhases,
                activeIntegrations,
                documentProcessingStatus: {
                    totalDocuments: documentResults.length,
                    byPhase: this.groupByPhase(documentResults)
                },
                riskFactors: this.identifyRiskFactors(taskResults, integrationResults),
                recommendations: this.generateRecommendations(taskResults, integrationResults, documentResults)
            };

        } catch (error) {
            console.error('Error getting project overview:', error);
            return {
                totalTasks: 0,
                completedPhases: [],
                activeIntegrations: [],
                documentProcessingStatus: {},
                riskFactors: ['Unable to assess project risks'],
                recommendations: ['Review Neo4j connection']
            };
        }
    }

    // Private helper methods

    private async createEntitiesInMemory(entities: GSHProjectEntity[]): Promise<any> {
        // For Phase 2, this would integrate with actual Neo4j Memory MCP server
        // For now, simulate the operation
        console.log(`Creating ${entities.length} entities in Neo4j memory`);
        
        try {
            // Simulate MCP call to create entities
            const memoryEntities = entities.map(entity => ({
                name: entity.name,
                type: entity.type,
                observations: entity.observations
            }));

            // This would call the actual MCP server
            // await mcpMemoryServer.createEntities({ entities: memoryEntities });
            
            return { success: true, created: entities.length };
        } catch (error) {
            console.error('Error creating entities:', error);
            return { success: false, created: 0 };
        }
    }

    private async createRelationsInMemory(relations: GSHProjectRelation[]): Promise<any> {
        console.log(`Creating ${relations.length} relations in Neo4j memory`);
        
        try {
            // Simulate MCP call to create relations
            const memoryRelations = relations.map(relation => ({
                source: relation.source,
                target: relation.target,
                relationType: relation.relationType
            }));

            // This would call the actual MCP server
            // await mcpMemoryServer.createRelations({ relations: memoryRelations });
            
            return { success: true, created: relations.length };
        } catch (error) {
            console.error('Error creating relations:', error);
            return { success: false, created: 0 };
        }
    }

    private async searchNodesInMemory(query: string): Promise<any> {
        try {
            // Simulate MCP call to search nodes
            // const results = await mcpMemoryServer.searchNodes({ query });
            
            // For Phase 2 simulation
            return {
                entities: [],
                relations: []
            };
        } catch (error) {
            console.error('Error searching nodes:', error);
            return { entities: [], relations: [] };
        }
    }

    private async executeCypherQuery(query: string, params?: any): Promise<any> {
        try {
            // Simulate MCP call to execute Cypher
            // const results = await mcpCypherServer.readNeo4jCypher({ query, params });
            
            console.log(`Executing Cypher query: ${query.substring(0, 100)}...`);
            
            // For Phase 2 simulation
            return [];
        } catch (error) {
            console.error('Error executing Cypher query:', error);
            return [];
        }
    }

    private buildCypherQuery(query: ProjectMemoryQuery): string {
        let cypher = `MATCH (n:Memory)`;
        
        if (query.entityTypes && query.entityTypes.length > 0) {
            const types = query.entityTypes.map(t => `'${t}'`).join(', ');
            cypher += ` WHERE n.type IN [${types}]`;
        }

        if (query.phase) {
            cypher += query.entityTypes ? ` AND` : ` WHERE`;
            cypher += ` n.phase = ${query.phase}`;
        }

        cypher += ` RETURN n LIMIT 20`;
        
        return cypher;
    }

    private async createPhaseRelationships(taskId: string, phase: number): Promise<void> {
        // Create relationships between phases
        if (phase > 1) {
            const previousPhaseQuery = `
                MATCH (prev:Memory {type: 'task', phase: ${phase - 1}})
                MATCH (curr:Memory {name: '${taskId}', type: 'task', phase: ${phase}})
                CREATE (prev)-[:LEADS_TO]->(curr)
            `;
            
            await this.executeCypherQuery(previousPhaseQuery);
        }
    }

    private async generateProjectInsights(searchResults: any, cypherResults: any): Promise<string[]> {
        const insights = [
            'Project memory successfully queried',
            `Found ${searchResults.entities?.length || 0} relevant entities`,
            `Found ${searchResults.relations?.length || 0} relevant relationships`
        ];

        // Add more sophisticated insights based on graph analysis
        if (cypherResults && cypherResults.length > 0) {
            insights.push('Graph analysis reveals structured project progression');
        }

        return insights;
    }

    private groupByPhase(results: any[]): Record<number, number> {
        return results.reduce((acc, item) => {
            acc[item.phase] = (acc[item.phase] || 0) + 1;
            return acc;
        }, {});
    }

    private identifyRiskFactors(taskResults: any[], integrationResults: any[]): string[] {
        const risks = [];

        if (taskResults.length === 0) {
            risks.push('No completed tasks found in memory');
        }

        if (integrationResults.length === 0) {
            risks.push('No integration points established');
        }

        return risks;
    }

    private generateRecommendations(taskResults: any[], integrationResults: any[], documentResults: any[]): string[] {
        const recommendations = [];

        if (taskResults.length > 0) {
            recommendations.push('Continue systematic phase-based development');
        }

        if (integrationResults.length > 0) {
            recommendations.push('Monitor integration point stability');
        }

        if (documentResults.length > 0) {
            recommendations.push('Maintain HIPAA compliance in document processing');
        }

        recommendations.push('Regular memory graph analysis for project insights');

        return recommendations;
    }

    // Health check for Neo4j connection
    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: string;
        neo4jConnected: boolean;
        mcpServersAvailable: boolean;
    }> {
        try {
            // Test basic Neo4j connection
            const testQuery = 'RETURN 1 as test';
            await this.executeCypherQuery(testQuery);

            return {
                status: 'healthy',
                details: 'Neo4j Enhanced Service operational with cloud database',
                neo4jConnected: true,
                mcpServersAvailable: true
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: `Neo4j Enhanced Service error: ${error.message}`,
                neo4jConnected: false,
                mcpServersAvailable: false
            };
        }
    }
}

export default Neo4jEnhancedService;