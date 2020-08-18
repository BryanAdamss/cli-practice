const fs = require("fs");
const ora = require("ora");
const path = require("path");
const axios = require("axios");
const Inquirer = require("inquirer");
const { promisify } = require("util");
const config = require("./config");
const repoName = config("getVal", "repo");

const fetchRepoList = async () => {
  const { data } = await axios.get(
    `https://api.github.com/orgs/${repoName}/repos`
  );

  return data;
};

const fetchTagList = async (repo) => {
  const { data } = await axios.get(
    `https://api.github.com/repos/${repoName}/${repo}/tags`
  );
  return data;
};

const wrapFetchAddLoding = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start(); // 开始loading
  const r = await fn(...args);
  spinner.succeed(); // 结束loading
  return r;
};

let downLoadGit = require("download-git-repo");
downLoadGit = promisify(downLoadGit);

const downloadDirectory = `${
  process.env[process.platform === "darwin" ? "HOME" : "USERPROFILE"]
}/.template`;

const download = async (repo, tag) => {
  let api = `${repoName}/${repo}`; // 下载项目
  if (tag) {
    api += `#${tag}`;
  }
  const dest = `${downloadDirectory}/${repo}`; // 将模板下载到对应的目录中
  await downLoadGit(api, dest);
  return dest; // 返回下载目录
};

let ncp = require("ncp");
ncp = promisify(ncp);

const MetalSmith = require("metalsmith"); // 遍历文件夹
let { render } = require("consolidate").ejs;
render = promisify(render); // 包装渲染方法

module.exports = async (projectName) => {
  const spinner = ora("fetching repo list");
  spinner.start(); // 开始loading
  let repos = await wrapFetchAddLoding(fetchRepoList, "fetching repo list")();

  spinner.succeed(); // 结束loading
  // 选择模板
  repos = repos.map((item) => item.name);
  const { repo } = await Inquirer.prompt({
    name: "repo",
    type: "list",
    message: "please choice repo template to create project",
    choices: repos, // 选择模式
  });
  console.log(repo);
  // 获取版本信息
  const spinnerTag = ora("fetching repo tags");
  spinnerTag.start();
  let tags = await wrapFetchAddLoding(fetchTagList, "fetching tag list")(repo);
  spinnerTag.succeed(); // 结束loading
  // 选择版本
  tags = tags.map((item) => item.name);
  const { tag } = await Inquirer.prompt({
    name: "tag",
    type: "list",
    message: "please choice repo template to create project",
    choices: tags,
  });

  // 下载项目
  const target = await wrapFetchAddLoding(download, "download template")(
    repo,
    tag
  );

  console.log(target);

  // 没有ask文件说明不需要编译
  if (!fs.existsSync(path.join(target, "ask.js"))) {
    await ncp(target, path.join(path.resolve(), projectName));
  } else {
    await new Promise((resovle, reject) => {
      MetalSmith(__dirname)
        .source(target) // 遍历下载的目录
        .destination(path.join(path.resolve(), projectName)) // 输出渲染后的结果
        .use(async (files, metal, done) => {
          // 弹框询问用户
          const result = await Inquirer.prompt(
            require(path.join(target, "ask.js"))
          );
          const data = metal.metadata();
          Object.assign(data, result); // 将询问的结果放到metadata中保证在下一个中间件中可以获取到;
          delete files["ask.js"];
          done();
        })
        .use((files, metal, done) => {
          Reflect.ownKeys(files).forEach(async (file) => {
            let content = files[file].contents.toString(); // 获取文件中的内容
            if (file.includes(".js") || file.includes(".json")) {
              // 如果是js或者json才有可能是模板;
              if (content.includes("<%")) {
                // 文件中用<% 我才需要编译
                content = await render(content, metal.metadata()); // 用数据渲染模板
                files[file].contents = Buffer.from(content); // 渲染好的结果替换即可
              }
            }
          });
          done();
        })
        .build((err) => {
          // 执行中间件
          if (!err) {
            resovle();
          } else {
            reject();
          }
        });
    });
  }
};
