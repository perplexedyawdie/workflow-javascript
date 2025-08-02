// --- ACTIVITIES ---
// These are the individual, stateless units of work that your workflow will orchestrate.
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv'

dotenv.config({ path: '/home/northway/Documents/hackathons/dapr-ai-hackathon/dapr-workflow/workflow-javascript/.env' })
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
/**
 * Activity 1: Validates the incoming user query.
 * It receives the initial data sent to the workflow.
 */
const validateQuery = async (ctx, input) => {
  console.log("--- Activity: validateQuery ---");
  console.log("Received input:", JSON.stringify(input, null, 2));

  // TODO: Add your query validation logic here.
  // For example, check for malicious input, check length, etc.
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: input.query,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Medical Query Validator Output",
        "description": "Defines the boolean output structure for the gatekeeper prompt, determining if a user query is valid for data retrieval.",
        "type": "object",
        "properties": {
          "is_valid_query": {
            "description": "A boolean flag that is true if the user's question is a valid request for data retrieval, and false otherwise.",
            "type": "boolean"
          },
          "reason": {
            "description": "A brief string explaining why the query is valid or invalid. This can be used for logging or for formulating a user-facing response.",
            "type": "string"
          }
        },
        "required": [
          "is_valid_query",
          "reason"
        ],
        "additionalProperties": false
      }
    }
  });

  // For now, we'll just simulate a successful validation and pass the data along.
  const validationResult = {
    originalQuery: input.query,
    validityCheck: JSON.parse(response.text),
    isValid: true,
    validatedAt: new Date().toISOString(),
  };

  console.log("Returning validation result:", JSON.stringify(validationResult, null, 2));
  return validationResult;
};

/**
 * Activity 2: Generates a Cypher query from the validated user query.
 * It receives the output from the `validateQuery` activity.
 */
const generateCypher = async (ctx, input) => {
  console.log("\n--- Activity: generateCypher ---");
  console.log("Received input from previous step:", JSON.stringify(input, null, 2));

  // TODO: Add your logic to call an AI model (e.g., OpenAI) to generate the Cypher query.
  // You will use `input.originalQuery` to send to the AI.

  // Simulate a generated Cypher query.
  const generatedData = {
    ...input, // Pass through the data from the previous step
    cypherQuery: `MATCH (p:Person {name: "Keanu Reeves"})-[:ACTED_IN]->(m:Movie) RETURN m.title;`,
    generatedAt: new Date().toISOString(),
  };

  console.log("Returning generated Cypher query:", JSON.stringify(generatedData, null, 2));
  return generatedData;
};

/**
 * Activity 3: Creates an audit log of the operation.
 * It receives the output from the `generateCypher` activity.
 */
const createAuditLog = async (ctx, input) => {
  console.log("\n--- Activity: createAuditLog ---");
  console.log("Received input for auditing:", JSON.stringify(input, null, 2));

  // TODO: Add your logic to save the audit trail to a database or logging service.
  // For example, log the original query, the generated Cypher, and timestamps.
  const auditId = `audit_${new Date().getTime()}`;
  console.log(`Audit log created with ID: ${auditId}`);

  // The result of this activity includes all previous data plus the audit confirmation.
  const finalResult = {
    ...input, // Pass through all previous data
    auditId: auditId,
    auditedAt: new Date().toISOString(),
    status: "SUCCESS",
  };

  console.log("Returning final result:", JSON.stringify(finalResult, null, 2));
  return finalResult;
};


// --- WORKFLOW ---
// The workflow defines the order and logic of the activity calls.

/**
 * The main workflow orchestrator.
 * It calls the activities in sequence, passing data between them.
 */
const aiCypherQueryGeneratorWorkflow = async function* (ctx, input) {
  const instanceId = ctx.instance_id;
  console.log(`\n>>> Starting workflow '${ctx.workflow_name}' with instance ID: ${instanceId}`);
  console.log(`>>> Initial payload: ${JSON.stringify(input)}`);

  try {
    // Step 1: Call the validation activity
    const validationResult = yield ctx.callActivity(validateQuery, input);

    // Step 2: Call the Cypher generation activity, passing the result from step 1
    const cypherResult = yield ctx.callActivity(generateCypher, validationResult);

    // Step 3: Call the audit log activity, passing the result from step 2
    const auditResult = yield ctx.callActivity(createAuditLog, cypherResult);

    console.log(`\n>>> Workflow finished successfully for instance ID: ${instanceId}`);

    // The final result of the workflow execution
    return {
      processed: true,
      ...auditResult,
    };
  } catch (error) {
    console.error(`\nXXX Workflow failed for instance ID: ${instanceId}`, error);

    // You can add a compensating activity here, like sending a failure notification.

    return { processed: false, error: error.message };
  }
};

// Export the workflow and all activities so the Dapr runtime can register them.
export {
  aiCypherQueryGeneratorWorkflow,
  validateQuery,
  generateCypher,
  createAuditLog,
};