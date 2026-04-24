import React from "react";
import { Button } from "@jho951/ui-components";

import { DocumentPageHeader } from "@features/document/ui/shell/index.ts";

import shellStyles from "@features/document/ui/shell/DocumentPageShell.module.css";
import styles from "./DocumentDetailView.module.css";

interface DocumentDetailFallbackProps {
  lead: string;
  onBack: () => void;
  statusMessage: string;
}

function DocumentDetailFallback({
  lead,
  onBack,
  statusMessage,
}: DocumentDetailFallbackProps): React.ReactElement {
  return (
    <section className={styles.content}>
      <div className={shellStyles.content}>
        <DocumentPageHeader
          eyebrow="문서 없음"
          title="문서를 찾을 수 없습니다."
          lead={lead}
        />
        <div className={`${shellStyles.surfacePanel} ${shellStyles.emptyState}`}>
          <div className={shellStyles.statusRow}>{statusMessage}</div>
          <Button type="button" variant="ghost" onClick={onBack}>
            문서 목록으로 이동
          </Button>
        </div>
      </div>
    </section>
  );
}

export { DocumentDetailFallback };
