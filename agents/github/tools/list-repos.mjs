/**
 * List GitHub repositories for the authenticated user
 */

export default {
  schema: {
    name: "github_list_repos",
    description: "List GitHub repositories for the authenticated user",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Type of repos: all, owner, member",
          default: "owner",
        },
        max_results: {
          type: "number",
          description: "Maximum number of repos to return",
          default: 30,
        },
      },
    },
  },
  async execute(input) {
    const { GITHUB_TOKEN } = process.env;

    if (!GITHUB_TOKEN) {
      return {
        output: "Error: Missing GITHUB_TOKEN credential",
        isError: true,
      };
    }

    const type = input.type || "owner";
    const perPage = input.max_results || 30;

    try {
      const response = await fetch(
        `https://api.github.com/user/repos?type=${type}&per_page=${perPage}&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Agav-Agent",
          },
        }
      );

      if (!response.ok) {
        return {
          output: `GitHub API error (${response.status}): ${response.statusText}`,
          isError: true,
        };
      }

      const repos = await response.json();

      if (repos.length === 0) {
        return {
          output: "No repositories found.",
          isError: false,
        };
      }

      const lines = [`Found ${repos.length} repositories:\n`];

      for (const repo of repos) {
        const visibility = repo.private ? "🔒 Private" : "🌐 Public";
        lines.push(
          `• ${repo.full_name} ${visibility}\n` +
            `  ${repo.description || "No description"}\n` +
            `  ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | ${repo.html_url}`
        );
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error listing repositories: ${error.message}`,
        isError: true,
      };
    }
  },
};
