import fs from "fs";
import os from "os";
import osenv from "osenv";
import uuid from "uuid";
import path from "path";
import xdgBaseDir from "xdg-basedir";

export default function getXdgDirectory(
  name: string,
  create: boolean = false
): string {
  let tempdir = os.tmpdir;

  // TODO: check this out more in detail
  let user = (osenv.user() || uuid.v4()).replace(/\\/g, '');
  var baseDirectory = xdgBaseDir[name] || path.join(tempdir(), user, `.${name}`);
  let drifterPath = path.join(baseDirectory, "drifter");
  if (create && !fs.existsSync(drifterPath)) {
    fs.mkdirSync(drifterPath);
  }
  return drifterPath;
}
