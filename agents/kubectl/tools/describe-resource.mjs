import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function kubectl(args, env) {
  const kubeconfigPath = env.KUBECONFIG_PATH;
  const finalArgs = kubeconfigPath ? ["--kubeconfig", kubeconfigPath, ...args] : args;
  try {
    const { stdout, stderr } = await execFileAsync("kubectl", finalArgs, { timeout: 30000 });
    return { stdout: stdout.trim(), stderr: stderr.trim(), error: null };
  } catch (err) {
    const msg = err.stderr || err.message || String(err);
    if (msg.includes("command not found") || msg.includes("is not recognized")) {
      return { stdout: "", stderr: "", error: "kubectl not found. Install it from: https://kubernetes.io/docs/tasks/tools/" };
    }
    return { stdout: "", stderr: "", error: msg };
  }
}

export default {
  schema: {
    name: "kubectl_describe_resource",
    description: "Describe a Kubernetes resource (pod, deployment, service, node, etc.) showing detailed state, events, and conditions",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", description: "Resource kind (e.g. pod, deployment, service, node, configmap)" },
        name: { type: "string", description: "Resource name" },
        namespace: { type: "string", description: "Namespace (required for namespace-scoped resources)" },
        context: { type: "string", description: "Kubectl context (cluster) to use" }
      },
      required: ["kind", "name"]
    }
  },
  async execute(input) {
    const args = ["describe", input.kind, input.name];

    if (input.namespace) {
      args.push("-n", input.namespace);
    }

    if (input.context) {
      args.push("--context", input.context);
    }

    const result = await kubectl(args, process.env);
    if (result.error) {
      return { output: `Error: ${result.error}`, isError: true };
    }
    if (!result.stdout) {
      return { output: `No output returned for ${input.kind}/${input.name}.`, isError: false };
    }
    return { output: result.stdout, isError: false };
  }
};
