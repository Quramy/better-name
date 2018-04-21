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
  const fromPrefix = new DefaultFileRef(fromPath, prj.getProjectDir());
  const { found } = await prj.find({ start: fromPrefix.id });
  if (!found.length) return prj;
  const renamedPrj = await found.reduce(async (prev, file) => {
    const next = await prev;
    const { found, rest } = await prj.findOne(file.getFile().id);
    const to = new DefaultFileRef(createToPath(file.getFile().path, toPath), prj.getProjectDir());
    if (found) {
      await found.getDoc().parse();
      found.getDoc().transformPreceding(to.id);
    }
    await Promise.all(rest.map(async docRef => {
      const doc = docRef.getDoc();
      await doc.parse();
      doc.transformFollowing({ from: file.getFile().id, to: to.id });
      return;
    }));
    if (!found) return next;
    await found.move(to);
    return next;
  }, Promise.resolve(prj));
  return await renamedPrj.commit();
}
