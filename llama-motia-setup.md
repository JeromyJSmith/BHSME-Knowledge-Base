# 🚀 LlamaIndex + LlamaCloud + Motia Integration: Complete GSH Intelligence Agent

## 📋 Comprehensive Task List & Implementation Guide

Based on my research, here's your complete roadmap for building a sophisticated
GSH intelligence agent using LlamaIndex/LlamaCloud with Motia, with Weaviate as
optional backup.

---

## 🏗️ **Architecture Overview**

**Primary Stack** : Motia + LlamaCloud + LlamaIndex **Alternative Stack** :
Motia + LlamaIndex + Weaviate (if you want to keep Weaviate)

### Key Advantages of LlamaCloud over Docling:

- **Superior Document Processing** : Supports 50+ formats vs Docling's limited
  set
- **Enterprise-Grade** : Built specifically for enterprise RAG applications
- **Managed Service** : No infrastructure management needed
- **Better Performance** : Optimized parsing with Fast/Balanced/Premium modes
- **Advanced Features** : Multimodal parsing, table extraction, layout
  preservation

---

## 📊 **Cost Analysis**

### LlamaCloud Pricing:

- **Free** : 10K credits (perfect for testing)
- **Starter** : 50K credits + up to 500K pay-as-you-go ($500)
- **Pro** : 500K credits + up to 5M pay-as-you-go ($5K)
- **Enterprise** : Custom pricing with unlimited features

### Credit Usage:

- 1,000 credits = $1
- Document parsing: ~100-500 credits per document
- Index operations: ~10-50 credits per query
- Your GSH project would likely fit in Pro tier initially

---

## 🎯 **Phase 1: Foundation Setup (Day 1-2)**

### Task 1.1: Project Architecture Setup

```bash
Copy# Create enhanced Motia project
npx motia@latest create -n gsh-llamacloud-agent
cd gsh-llamacloud-agent

# Install LlamaCloud dependencies
npm install llama-cloud-services llamaindex @llamaindex/env
npm install --save-dev @types/node

# Install Motia dependencies
npm install multer express cors helmet
npm install --save-dev @types/multer @types/express @types/cors
```

### Task 1.2: Environment Configuration

```bash
Copy# .env file setup
LLAMACLOUD_API_KEY=llx-your-api-key-here
OPENAI_API_KEY=your-openai-key-here
OPENAI_MODEL=gpt-4o
LLAMACLOUD_BASE_URL=https://api.cloud.llamaindex.ai
LLAMACLOUD_PROJECT_NAME=gsh-analysis

# Optional: EU region
# LLAMACLOUD_BASE_URL=https://api.cloud.eu.llamaindex.ai

# Motia configs
DATABASE_URL=postgresql://user:password@localhost:5432/gsh_llamacloud
MAX_FILE_SIZE=52428800  # 50MB for GSH documents
UPLOAD_DIR=./uploads

# Optional: Keep Weaviate as backup
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=optional-key-here
```

### Task 1.3: Directory Structure

```
gsh-llamacloud-agent/
├── steps/
│   ├── api-steps/
│   │   ├── upload-documents.step.ts
│   │   ├── research-with-context.step.ts
│   │   └── query-documents.step.ts
│   └── event-steps/
│       ├── process-with-llamacloud.step.ts
│       ├── generate-context-queries.step.ts
│       ├── web-research.step.ts
│       └── compile-report.step.ts
├── services/
│   ├── llamacloud.service.ts
│   ├── llamaindex.service.ts
│   └── openai.service.ts
├── types/
│   └── index.ts
├── utils/
│   └── helpers.ts
└── uploads/
```

---

## 🔄 **Phase 2: Core LlamaCloud Integration (Day 3-5)**

### Task 2.1: LlamaCloud Service Implementation

```typescript
Copy; // services/llamacloud.service.ts
import { LlamaCloudIndex } from "llamaindex";
import { LlamaParse } from "llama-cloud-services";

export class LlamaCloudService {
    private llamaParse: LlamaParse;
    private apiKey: string;
    private projectName: string;

    constructor() {
        this.apiKey = process.env.LLAMACLOUD_API_KEY!;
        this.projectName = process.env.LLAMACLOUD_PROJECT_NAME!;
        this.llamaParse = new LlamaParse({
            apiKey: this.apiKey,
            resultType: "markdown", // or 'text'
            parsingInstruction:
                "Extract all content with focus on healthcare compliance, financial data, and regulatory requirements",
            verbose: true,
        });
    }

    async parseDocuments(filePaths: string[]): Promise<Document[]> {
        const documents = [];

        for (const filePath of filePaths) {
            try {
                const parsedDocument = await this.llamaParse.loadData(filePath);
                documents.push(...parsedDocument);
            } catch (error) {
                console.error(`Error parsing ${filePath}:`, error);
            }
        }

        return documents;
    }

    async createOrUpdateIndex(
        documents: Document[],
        indexName: string,
    ): Promise<LlamaCloudIndex> {
        try {
            // Try to connect to existing index
            const index = new LlamaCloudIndex({
                name: indexName,
                projectName: this.projectName,
                apiKey: this.apiKey,
            });

            // Add new documents to existing index
            await index.insert(documents);
            return index;
        } catch (error) {
            // Create new index if it doesn't exist
            return await LlamaCloudIndex.fromDocuments(
                documents,
                indexName,
                {
                    projectName: this.projectName,
                    apiKey: this.apiKey,
                },
            );
        }
    }

    async queryIndex(
        indexName: string,
        query: string,
        topK: number = 5,
    ): Promise<any[]> {
        const index = new LlamaCloudIndex({
            name: indexName,
            projectName: this.projectName,
            apiKey: this.apiKey,
        });

        const queryEngine = index.asQueryEngine();
        const response = await queryEngine.query(query);

        return response.sourceNodes || [];
    }
}
```

### Task 2.2: Document Upload API Step

```typescript
Copy; // steps/api-steps/upload-documents.step.ts
import multer from "multer";
import path from "path";
import { Request, Response } from "express";

const storage = multer.diskStorage({
    destination: process.env.UPLOAD_DIR || "./uploads",
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${
                path.extname(file.originalname)
            }`,
        );
    },
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || "52428800") }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Unsupported file type"), false);
        }
    },
});

export const config = {
    type: "api",
    path: "/documents/upload",
    method: "POST",
    name: "UploadDocuments",
    emits: ["documents-uploaded"],
    flows: ["GSHDocumentProcessing"],
    middleware: [upload.array("documents", 10)],
};

export const handler = async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        const {
            project_id = "gsh-analysis",
            index_name = "gsh-main-index",
            description = "",
            parsing_mode = "balanced", // fast, balanced, premium
        } = req.body;

        if (!files || files.length === 0) {
            return { status: 400, body: { error: "No files uploaded" } };
        }

        const batchId = `batch-${Date.now()}`;
        const uploadedFiles = files.map((file) => ({
            filename: file.filename,
            originalname: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
        }));

        await emit("documents-uploaded", {
            batchId,
            projectId: project_id,
            indexName: index_name,
            description,
            parsingMode: parsing_mode,
            files: uploadedFiles,
            timestamp: new Date().toISOString(),
        });

        return {
            status: 200,
            body: {
                message: "Documents uploaded successfully",
                batchId,
                filesCount: uploadedFiles.length,
                files: uploadedFiles.map((f) => ({
                    name: f.originalname,
                    size: f.size,
                })),
            },
        };
    } catch (error) {
        return {
            status: 500,
            body: { error: error.message },
        };
    }
};
```

### Task 2.3: LlamaCloud Document Processing Step

```typescript
Copy; // steps/event-steps/process-with-llamacloud.step.ts
import { LlamaCloudService } from "../../services/llamacloud.service";

export const config = {
    type: "event",
    subscribes: ["documents-uploaded"],
    emits: ["documents-processed-llamacloud"],
    flows: ["GSHDocumentProcessing"],
    name: "ProcessWithLlamaCloud",
};

export const handler = async (event: any) => {
    try {
        const {
            batchId,
            projectId,
            indexName,
            files,
            parsingMode,
            description,
        } = event.data;

        const llamaCloudService = new LlamaCloudService();

        // Extract file paths
        const filePaths = files.map((file: any) => file.path);

        // Parse documents with LlamaCloud
        console.log(
            `Processing ${filePaths.length} documents with LlamaCloud (${parsingMode} mode)`,
        );
        const documents = await llamaCloudService.parseDocuments(filePaths);

        // Create or update index
        const index = await llamaCloudService.createOrUpdateIndex(
            documents,
            indexName,
        );

        // Calculate processing stats
        const totalChunks = documents.length;
        const totalTokens = documents.reduce(
            (sum, doc) => sum + (doc.text?.length || 0),
            0,
        );

        await emit("documents-processed-llamacloud", {
            batchId,
            projectId,
            indexName,
            documentsProcessed: files.length,
            totalChunks,
            totalTokens,
            parsingMode,
            description,
            processedAt: new Date().toISOString(),
        });

        return {
            success: true,
            batchId,
            documentsProcessed: files.length,
            totalChunks,
            indexName,
        };
    } catch (error) {
        console.error("LlamaCloud processing error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
```

---

## 🔍 **Phase 3: Context-Aware Research Integration (Day 6-8)**

### Task 3.1: Context-Aware Research API

```typescript
Copy; // steps/api-steps/research-with-context.step.ts
import { LlamaCloudService } from "../../services/llamacloud.service";
import { OpenAIService } from "../../services/openai.service";

export const config = {
    type: "api",
    path: "/research/context-aware",
    method: "POST",
    name: "ContextAwareResearch",
    emits: ["context-research-started"],
    flows: ["GSHResearch"],
};

export const handler = async (req: Request) => {
    try {
        const {
            query,
            projectId = "gsh-analysis",
            indexName = "gsh-main-index",
            breadth = 4,
            depth = 2,
            useDocumentContext = true,
            contextLimit = 8,
            researchMode = "comprehensive", // comprehensive, targeted, compliance-focused
        } = req.body;

        const requestId = `research-${Date.now()}-${
            Math.random().toString(36).substr(2, 9)
        }`;
        let documentContext = "";
        let contextSources = [];

        if (useDocumentContext) {
            const llamaCloudService = new LlamaCloudService();

            // Query the LlamaCloud index for relevant context
            const contextNodes = await llamaCloudService.queryIndex(
                indexName,
                query,
                contextLimit,
            );

            // Extract context and sources
            if (contextNodes.length > 0) {
                documentContext = contextNodes
                    .map((node) =>
                        `[${node.metadata?.filename || "Unknown"}] ${node.text}`
                    )
                    .join("\n\n");

                contextSources = contextNodes.map((node) => ({
                    filename: node.metadata?.filename || "Unknown",
                    relevanceScore: node.score || 0,
                    excerpt: node.text?.substring(0, 200) + "...",
                }));
            }
        }

        // Store research parameters
        await storeResearchRequest(requestId, {
            query,
            projectId,
            indexName,
            breadth,
            depth,
            documentContext,
            contextSources,
            researchMode,
            useDocumentContext,
            contextLimit,
        });

        await emit("context-research-started", {
            requestId,
            query,
            projectId,
            indexName,
            breadth,
            depth,
            documentContext,
            contextSources,
            researchMode,
            timestamp: new Date().toISOString(),
        });

        return {
            status: 200,
            body: {
                message: "Context-aware research started",
                requestId,
                contextFound: documentContext.length > 0,
                contextSourcesCount: contextSources.length,
                contextSources: contextSources.slice(0, 3), // Return top 3 sources
            },
        };
    } catch (error) {
        return {
            status: 500,
            body: { error: error.message },
        };
    }
};
```

### Task 3.2: Enhanced Query Generation

```typescript
Copy; // steps/event-steps/generate-context-queries.step.ts
import { OpenAIService } from "../../services/openai.service";

export const config = {
    type: "event",
    subscribes: ["context-research-started"],
    emits: ["enhanced-queries-generated"],
    flows: ["GSHResearch"],
    name: "GenerateContextQueries",
};

export const handler = async (event: any) => {
    try {
        const {
            requestId,
            query,
            projectId,
            breadth,
            documentContext,
            researchMode,
            contextSources,
        } = event.data;

        const openaiService = new OpenAIService();

        // Create research mode specific prompts
        const researchPrompts = {
            comprehensive: `
        Generate comprehensive research queries for: ${query}
      
        DOCUMENT CONTEXT:
        ${documentContext}
      
        Focus on:
        1. Regulatory compliance (DHCS, OSHPD, BHCIP)
        2. Financial analysis and projections
        3. Timeline and implementation planning
        4. Risk assessment and mitigation
        5. Competitive landscape analysis
        6. Technical requirements and specifications
      
        Generate ${breadth} specific, actionable search queries that complement the document context.
      `,
            targeted: `
        Generate targeted research queries for: ${query}
      
        DOCUMENT CONTEXT:
        ${documentContext}
      
        Focus specifically on gaps in the document context and areas requiring external validation.
        Generate ${breadth} precise queries that address missing information.
      `,
            "compliance-focused": `
        Generate compliance-focused research queries for: ${query}
      
        DOCUMENT CONTEXT:
        ${documentContext}
      
        Focus exclusively on:
        1. Regulatory requirements and deadlines
        2. Compliance documentation needs
        3. Audit requirements
        4. Legal obligations
        5. Industry standards
      
        Generate ${breadth} compliance-specific queries.
      `,
        };

        const selectedPrompt = researchPrompts[researchMode] ||
            researchPrompts.comprehensive;

        const searchQueries = await openaiService.generateSearchQueries(
            selectedPrompt,
            breadth,
        );

        await emit("enhanced-queries-generated", {
            requestId,
            projectId,
            originalQuery: query,
            searchQueries,
            researchMode,
            contextUsed: documentContext.length > 0,
            contextSourcesCount: contextSources?.length || 0,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            queriesGenerated: searchQueries.length,
            researchMode,
        };
    } catch (error) {
        console.error("Error generating context queries:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
```

---

## 🌐 **Phase 4: Web Research & Analysis (Day 9-11)**

### Task 4.1: Firecrawl Integration Step

```typescript
Copy; // steps/event-steps/web-research.step.ts
import { FirecrawlService } from "../../services/firecrawl.service";

export const config = {
    type: "event",
    subscribes: ["enhanced-queries-generated"],
    emits: ["web-research-completed"],
    flows: ["GSHResearch"],
    name: "WebResearch",
};

export const handler = async (event: any) => {
    try {
        const {
            requestId,
            searchQueries,
            researchMode,
            contextSourcesCount,
        } = event.data;

        const firecrawlService = new FirecrawlService();

        // Parallel search execution with rate limiting
        const searchResults = [];
        const batchSize = 2; // Adjust based on API limits

        for (let i = 0; i < searchQueries.length; i += batchSize) {
            const batch = searchQueries.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map((query) =>
                    firecrawlService.searchWithRetry(query, 5)
                ),
            );
            searchResults.push(...batchResults.flat());

            // Rate limiting delay
            if (i + batchSize < searchQueries.length) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }

        // Filter and rank results
        const filteredResults = searchResults
            .filter((result) => result.content && result.content.length > 100)
            .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
            .slice(0, 20); // Top 20 results

        await emit("web-research-completed", {
            requestId,
            searchQueries,
            searchResults: filteredResults,
            researchMode,
            contextSourcesCount,
            totalResults: filteredResults.length,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            totalResults: filteredResults.length,
            researchMode,
        };
    } catch (error) {
        console.error("Web research error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
```

### Task 4.2: Comprehensive Analysis Step

```typescript
Copy; // steps/event-steps/analyze-with-context.step.ts
import { OpenAIService } from "../../services/openai.service";
import { LlamaCloudService } from "../../services/llamacloud.service";

export const config = {
    type: "event",
    subscribes: ["web-research-completed"],
    emits: ["comprehensive-analysis-completed"],
    flows: ["GSHResearch"],
    name: "AnalyzeWithContext",
};

export const handler = async (event: any) => {
    try {
        const {
            requestId,
            searchResults,
            researchMode,
            contextSourcesCount,
        } = event.data;

        // Get original research context
        const researchData = await getResearchRequest(requestId);
        const { documentContext, query, contextSources } = researchData;

        const openaiService = new OpenAIService();

        // Create analysis prompt based on research mode
        const analysisPrompt = `
      You are analyzing research results for a healthcare infrastructure project (Good Samaritan Hospital).
    
      ORIGINAL QUERY: ${query}
    
      DOCUMENT CONTEXT (${contextSourcesCount} sources):
      ${documentContext}
    
      WEB RESEARCH RESULTS:
      ${
            searchResults.map((result: any, index: number) => `
        ${index + 1}. ${result.title}
        URL: ${result.url}
        Content: ${result.content}
      `).join("\n")
        }
    
      ANALYSIS REQUIREMENTS:
      1. Synthesize web research with document context
      2. Identify key insights for healthcare project
      3. Highlight regulatory compliance considerations
      4. Assess financial implications and ROI
      5. Identify potential risks and mitigation strategies
      6. Provide actionable recommendations
      7. Identify information gaps requiring further research
    
      FOCUS AREAS:
      - DHCS/OSHPD/BHCIP compliance requirements
      - Financial projections and budget analysis
      - Timeline and implementation planning
      - Risk assessment and contingency planning
      - Competitive landscape and market positioning
    
      Provide a comprehensive analysis as a structured JSON object with:
      - executive_summary
      - key_findings (array of findings with confidence scores)
      - regulatory_analysis (compliance requirements and deadlines)
      - financial_insights (cost estimates, ROI projections)
      - risk_assessment (risks with severity and mitigation strategies)
      - recommendations (prioritized action items)
      - information_gaps (areas needing more research)
      - next_steps (immediate actions required)
    `;

        const analysis = await openaiService.generateStructuredAnalysis(
            analysisPrompt,
        );

        await emit("comprehensive-analysis-completed", {
            requestId,
            analysis,
            researchMode,
            searchResultsCount: searchResults.length,
            contextSourcesCount,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            analysis,
            researchMode,
        };
    } catch (error) {
        console.error("Analysis error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
```

---

## 📊 **Phase 5: Reporting & Output (Day 12-14)**

### Task 5.1: Comprehensive Report Generation

```typescript
Copy; // steps/event-steps/compile-report.step.ts
import { OpenAIService } from "../../services/openai.service";
import { LlamaCloudService } from "../../services/llamacloud.service";

export const config = {
    type: "event",
    subscribes: ["comprehensive-analysis-completed"],
    emits: ["final-report-ready"],
    flows: ["GSHResearch"],
    name: "CompileReport",
};

export const handler = async (event: any) => {
    try {
        const {
            requestId,
            analysis,
            researchMode,
            searchResultsCount,
            contextSourcesCount,
        } = event.data;

        const researchData = await getResearchRequest(requestId);
        const { query, documentContext, contextSources } = researchData;

        const openaiService = new OpenAIService();

        // Generate executive presentation
        const reportPrompt = `
      Create a comprehensive executive research report for Good Samaritan Hospital project.
    
      RESEARCH QUERY: ${query}
      RESEARCH MODE: ${researchMode}
      SOURCES: ${contextSourcesCount} document sources, ${searchResultsCount} web sources
    
      ANALYSIS DATA:
      ${JSON.stringify(analysis, null, 2)}
    
      DOCUMENT CONTEXT SUMMARY:
      ${documentContext.substring(0, 1000)}...
    
      Create a professional executive report with:
    
      1. EXECUTIVE SUMMARY (2-3 paragraphs)
      2. PROJECT OVERVIEW
      3. KEY FINDINGS & INSIGHTS
      4. REGULATORY COMPLIANCE ANALYSIS
         - DHCS requirements and timeline
         - OSHPD approval process
         - BHCIP program compliance
      5. FINANCIAL ANALYSIS
         - Cost estimates and projections
         - ROI analysis
         - Funding requirements
      6. RISK ASSESSMENT & MITIGATION
      7. STRATEGIC RECOMMENDATIONS
      8. IMPLEMENTATION ROADMAP
      9. NEXT STEPS & ACTION ITEMS
      10. APPENDICES
          - Source documents summary
          - Research methodology
          - Assumptions and limitations
    
      Format as a comprehensive JSON structure suitable for:
      - Executive presentation
      - Board reporting
      - Stakeholder communication
      - Implementation planning
    
      Include confidence scores for key findings and recommendations.
    `;

        const report = await openaiService.generateExecutiveReport(
            reportPrompt,
        );

        // Store final report
        await storeResearchReport(requestId, {
            ...report,
            metadata: {
                projectId: researchData.projectId,
                originalQuery: query,
                researchMode,
                documentSources: contextSources,
                webSourcesCount: searchResultsCount,
                contextSourcesCount,
                completedAt: new Date().toISOString(),
                requestId,
            },
        });

        await emit("final-report-ready", {
            requestId,
            report,
            researchMode,
            totalSources: contextSourcesCount + searchResultsCount,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            reportGenerated: true,
            requestId,
        };
    } catch (error) {
        console.error("Report compilation error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};
```

### Task 5.2: Report Retrieval API

```typescript
Copy; // steps/api-steps/get-report.step.ts
export const config = {
    type: "api",
    path: "/research/report/:requestId",
    method: "GET",
    name: "GetReport",
    flows: ["GSHResearch"],
};

export const handler = async (req: Request) => {
    try {
        const { requestId } = req.params;
        const { format = "json" } = req.query;

        const report = await getResearchReport(requestId);

        if (!report) {
            return {
                status: 404,
                body: { error: "Report not found" },
            };
        }

        // Format response based on requested format
        if (format === "pdf") {
            // Generate PDF version (implement PDF generation)
            const pdfBuffer = await generatePDFReport(report);
            return {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition":
                        `attachment; filename="GSH-Report-${requestId}.pdf"`,
                },
                body: pdfBuffer,
            };
        } else if (format === "markdown") {
            // Generate Markdown version
            const markdownReport = await generateMarkdownReport(report);
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/markdown",
                    "Content-Disposition":
                        `attachment; filename="GSH-Report-${requestId}.md"`,
                },
                body: markdownReport,
            };
        }

        return {
            status: 200,
            body: {
                requestId,
                report,
                generatedAt: report.metadata.completedAt,
                totalSources: report.metadata.contextSourcesCount +
                    report.metadata.webSourcesCount,
            },
        };
    } catch (error) {
        return {
            status: 500,
            body: { error: error.message },
        };
    }
};
```

---

## 🔍 **Phase 6: Query & Management APIs (Day 15-16)**

### Task 6.1: Document Query API

```typescript
Copy; // steps/api-steps/query-documents.step.ts
import { LlamaCloudService } from "../../services/llamacloud.service";

export const config = {
    type: "api",
    path: "/documents/query",
    method: "POST",
    name: "QueryDocuments",
    flows: ["GSHQuery"],
};

export const handler = async (req: Request) => {
    try {
        const {
            query,
            indexName = "gsh-main-index",
            topK = 10,
            minScore = 0.7,
            includeMetadata = true,
        } = req.body;

        const llamaCloudService = new LlamaCloudService();

        // Query the index
        const results = await llamaCloudService.queryIndex(
            indexName,
            query,
            topK,
        );

        // Filter by minimum score
        const filteredResults = results.filter((result) =>
            (result.score || 0) >= minScore
        );

        // Format response
        const formattedResults = filteredResults.map((result) => ({
            content: result.text,
            metadata: includeMetadata ? result.metadata : undefined,
            relevanceScore: result.score || 0,
            nodeId: result.nodeId,
        }));

        return {
            status: 200,
            body: {
                query,
                indexName,
                resultsCount: formattedResults.length,
                totalResults: results.length,
                results: formattedResults,
            },
        };
    } catch (error) {
        return {
            status: 500,
            body: { error: error.message },
        };
    }
};
```

### Task 6.2: Project Status API

```typescript
Copy// steps/api-steps/project-status.step.ts
export const config = {
  type: 'api',
  path: '/projects/:projectId/status',
  method: 'GET',
  name: 'ProjectStatus',
  flows: ['GSHProject']
};

export const handler = async (req: Request) => {
  try {
    const { projectId } = req.params;
  
    // Get project statistics
    const stats = await getProjectStats(projectId);
    const recentResearch = await getRecentResearchRequests(projectId, 5);
    const recentUploads = await getRecentUploads(projectId, 5);
  
    return {
      status: 200,
      body: {
        projectId,
        statistics: {
          totalDocuments: stats.totalDocuments,
          totalResearchRequests: stats.totalResearchRequests,
          totalCreditsUsed: stats.totalCreditsUsed,
          last
```
