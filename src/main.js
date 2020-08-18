const path = require("path");
const program = require("commander");
const { version } = require("./utils/constants");

const actionsMap = {
  create: {
    // 创建模板
    description: "create project",
    examples: ["zhu-cli create <template-name>"],
  },
  config: {
    // 配置配置文件
    description: "config info",
    examples: ["zhu-cli config get <k>", "zhu-cli config set <k> <v>"],
  },
  "*": {
    description: "command not found",
  },
};

// 循环创建命令
Object.keys(actionsMap).forEach((action) => {
  program
    .command(action) // 命令的名称
    .description(actionsMap[action].description) // 命令的描述
    .action(() => {
      // 动作
      if (action === "*") {
        console.log(actionsMap[action].description);
      } else {
        require(path.resolve(__dirname, action))(...process.argv.slice(3));
      }
    });
});

program.on("--help", () => {
  console.log("Examples");
  Object.keys(actionsMap).forEach((action) => {
    (actionsMap[action].examples || []).forEach((example) => {
      console.log(` ${example}`);
    });
  });
});

program.version(version).parse(process.argv);
