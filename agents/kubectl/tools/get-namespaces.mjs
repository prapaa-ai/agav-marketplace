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
    name: "kubectl_get_namespaces",
    description: "List all Kubernetes namespaces with their status and age",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        context: { type: "string", description: "Kubectl context (cluster) to use" }
      }
    }
  },
  async execute(input) {
    const args = ["get", "namespaces"];

    if (input.context) {
      args.push("--context", input.context);
    }

    const result = await kubectl(args, process.env);
    if (result.error) {
      return { output: `Error: ${result.error}`, isError: true };
    }
    if (!result.stdout) {
      return { output: "No namespaces found.", isError: false };
    }
    return { output: result.stdout, isError: false };
  }
};
