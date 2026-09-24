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
    name: "kubectl_get_logs",
    description: "Fetch logs from a Kubernetes pod, optionally filtered by container",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        pod: { type: "string", description: "Pod name" },
        namespace: { type: "string", description: "Namespace the pod is in" },
        container: { type: "string", description: "Container name (required for multi-container pods)" },
        tail_lines: { type: "number", description: "Number of lines to tail from the end of the log (default: 50)" },
        context: { type: "string", description: "Kubectl context (cluster) to use" }
      },
      required: ["pod"]
    }
  },
  async execute(input) {
    const tailLines = (typeof input.tail_lines === "number" && input.tail_lines > 0) ? input.tail_lines : 50;
    const args = ["logs", input.pod, `--tail=${tailLines}`];

    if (input.namespace) {
      args.push("-n", input.namespace);
    }

    if (input.container) {
      args.push("-c", input.container);
    }

    if (input.context) {
      args.push("--context", input.context);
    }

    const result = await kubectl(args, process.env);
    if (result.error) {
      return { output: `Error: ${result.error}`, isError: true };
    }
    if (!result.stdout) {
      return { output: `No logs found for pod: ${input.pod}`, isError: false };
    }
    return { output: result.stdout, isError: false };
  }
};
