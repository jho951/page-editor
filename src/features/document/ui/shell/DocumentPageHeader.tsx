import React from "react";

import styles from "./DocumentPageShell.module.css";

interface DocumentPageHeaderProps {
  actions?: React.ReactNode;
  eyebrow: React.ReactNode;
  lead?: React.ReactNode;
  meta?: React.ReactNode;
  title: React.ReactNode;
}

function DocumentPageHeader({
  actions,
  eyebrow,
  lead,
  meta,
  title,
}: DocumentPageHeaderProps): React.ReactElement {
  return (
    <>
      <div className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.eyebrow}>{eyebrow}</div>
            <div className={styles.titleWrap}>
              <h1 className={styles.title}>{title}</h1>
            </div>
          </div>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
        </div>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </>
  );
}

export { DocumentPageHeader };
