import { Project } from "./types";
import { DefaultFileRef } from "./file-util";

export async function rename(prj: Project, fromPath: string, toPath: string) {
  const docRefs = await prj.getDocumentsList();
  const docs = docRefs.map(ref => ref.getRef());
  const from = new DefaultFileRef(fromPath, prj.getProjectDir());
  const to = new DefaultFileRef(toPath, prj.getProjectDir());
  const selfDoc = docs.find(doc => doc.fileRef.id === from.id);
  const restDocs = docs.filter(doc => doc.fileRef.id !== from.id);
  if (selfDoc) {
    await selfDoc.parse();
    selfDoc.transformPreceding(to.id);
  }
  await Promise.all(restDocs.map(async doc => {
    await doc.parse();
    doc.transformFollowing({ from: from.id, to: to.id });
    await doc.flush();
    return;
  }));
  if (!selfDoc) return prj;
  await selfDoc.move(to);
  return prj;
}

