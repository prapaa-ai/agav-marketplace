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
    name: "kubectl_get_pods",
    description: "List Kubernetes pods in a namespace or across all namespaces",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace to list pods in (omit for default namespace)" },
        context: { type: "string", description: "Kubectl context (cluster) to use" },
        all_namespaces: { type: "boolean", description: "List pods across all namespaces" }
      }
    }
  },
  async execute(input) {
    const args = ["get", "pods", "-o", "wide"];

    if (input.all_namespaces) {
      args.push("-A");
    } else if (input.namespace) {
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
      return { output: "No pods found.", isError: false };
    }
    return { output: result.stdout, isError: false };
  }
};
