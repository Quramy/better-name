import { Project } from "./types";
import { DefaultFileRef } from "./file-util";
import * as path from "path";

function createToPath(from: string, to: string) {
  const f = path.basename(from);
  if (path.extname(to) === "") {
    return path.join(to, f);
  } else {
    return to;
  }
}

export async function rename(prj: Project, fromPath: string, toPath: string) {
  const to = new DefaultFileRef(createToPath(fromPath, toPath), prj.getProjectDir());
  const from = new DefaultFileRef(fromPath, prj.getProjectDir());
  const { found, rest } = await prj.findOne(from.id);
  if (found) {
    await found.getDoc().parse();
    found.getDoc().transformPreceding(to.id);
  }
  await Promise.all(rest.map(async docRef => {
    const doc = docRef.getDoc();
    await doc.parse();
    doc.transformFollowing({ from: from.id, to: to.id });
    await doc.flush();
    return;
  }));
  if (!found) return prj;
  await found.move(to);
  return prj;
}

