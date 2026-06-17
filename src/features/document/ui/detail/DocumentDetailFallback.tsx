import React from "react";
import { Button } from "@jho951/ui-components";
import { useI18n } from "@app/provider/useI18n.ts";

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
  const { t } = useI18n();

  return (
    <section className={styles.content}>
      <div className={shellStyles.content}>
        <DocumentPageHeader
          eyebrow={t("document.detail.missing.eyebrow")}
          title={t("document.detail.missing.title")}
          lead={lead}
        />
        <div className={`${shellStyles.surfacePanel} ${shellStyles.emptyState}`}>
          <div className={shellStyles.statusRow}>{statusMessage}</div>
          <Button type="button" variant="ghost" onClick={onBack}>
            {t("document.detail.missing.back")}
          </Button>
        </div>
      </div>
    </section>
  );
}

export { DocumentDetailFallback };
