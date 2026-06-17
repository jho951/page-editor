/**
 * 상단 글로벌 내비게이션 UI를 렌더링합니다.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { useI18n } from "@app/provider/useI18n.ts";
import { useTheme } from "@app/provider/useTheme.ts";

import type { GnbProps } from "@features/layout/ui/gnb/Gnb.types.ts";
import {
  layoutActions,
  movePageToTrashRemote,
} from "@features/layout/state/layout.slice.ts";
import { selectPinnedDocIds } from "@features/layout/state/layout.selector.ts";
import { buildStartFrontendRootUrl, selectAuthUser } from "@features/auth/index.ts";
import { logoutAuth } from "@features/auth/state/auth.slice.ts";

import { uiActions } from "@app/state/ui.slice.ts";

import { Button, Icon } from "@jho951/ui-components";

import styles from "./Gnb.module.css";

type HeaderMode = "default" | "docText";
type ProfileDialogMode = "settings" | "profile" | null;

const PROFILE_AVATAR_STORAGE_KEY = "editor.profile-avatar";
const PROFILE_AVATAR_REMOVED_SENTINEL = "__none__";

function readStoredAvatar(): string | null | undefined {
  if (typeof window === "undefined") return undefined;

  const stored = window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY);
  if (stored == null) return undefined;
  if (stored === PROFILE_AVATAR_REMOVED_SENTINEL) return null;
  return stored;
}

function persistAvatar(nextAvatar: string | null): void {
  if (typeof window === "undefined") return;

  if (nextAvatar == null) {
    window.localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, PROFILE_AVATAR_REMOVED_SENTINEL);
    return;
  }

  window.localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, nextAvatar);
}

/**
 * 상단 글로벌 내비게이션 바를 렌더링합니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function Gnb({ profile, onOpenMobileMenu }: GnbProps): React.ReactElement {
  const { id } = useParams<{ id: string }>();

  const location = useLocation();

  const navigate = useNavigate();

  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const isDocRoute = location.pathname.startsWith("/doc/");

  const pinnedDocIds = useSelector(selectPinnedDocIds);
  const [profileLabel, setProfileLabel] = useState(profile);
  const [dialogMode, setDialogMode] = useState<ProfileDialogMode>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(() => readStoredAvatar() ?? null);
  const [avatarDraftImageUrl, setAvatarDraftImageUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isPinned = id && isDocRoute ? pinnedDocIds.includes(id) : false;

  useEffect(() => {
    setProfileLabel(profile);
  }, [profile]);

  useEffect(() => {
    const storedAvatar = readStoredAvatar();
    if (storedAvatar !== undefined) {
      setAvatarImageUrl(storedAvatar);
      return;
    }

    setAvatarImageUrl(user?.avatarUrl ?? null);
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (!dialogMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialogMode(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogMode]);

  const derivedName = user?.name ?? (!String(profileLabel).includes("@") ? String(profileLabel) : "");
  const derivedEmail = user?.email ?? (String(profileLabel).includes("@") ? String(profileLabel) : "");
  const avatarInitial = String(profileLabel || "U").slice(0, 1).toUpperCase();
  const languageLabel = language === "ko"
    ? t("common.language.korean")
    : t("common.language.english");

  const onTogglePinned = useCallback(() => {
    if (!id || !isDocRoute) return;
    dispatch(layoutActions.togglePinned(id));
  }, [dispatch, id, isDocRoute]);

  const onMoveToTrash = useCallback(async () => {
    if (!id || !isDocRoute) return;
    try {
      await dispatch(movePageToTrashRemote({ pageId: id })).unwrap();
    } catch {
      return;
    }
    navigate("/");
  }, [dispatch, id, isDocRoute, navigate]);

  const onLogout = useCallback(() => {
    const redirectUrl = buildStartFrontendRootUrl();

    void dispatch(logoutAuth())
      .unwrap()
      .catch(() => undefined)
      .finally(() => {
        if (typeof window !== "undefined") {
          window.location.replace(redirectUrl);
        }
      });
  }, [dispatch]);

  const onOpenSettingsDialog = useCallback(() => {
    setDialogMode("settings");
  }, []);

  const onOpenProfileDialog = useCallback(() => {
    setNameDraft(derivedName);
    setEmailDraft(derivedEmail);
    setAvatarDraftImageUrl(avatarImageUrl);
    setDialogMode("profile");
  }, [avatarImageUrl, derivedEmail, derivedName]);

  const onCloseDialog = useCallback(() => {
    setDialogMode(null);
  }, []);

  const onSaveProfile = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = nameDraft.trim();
    const nextEmail = emailDraft.trim();
    const nextProfileLabel = nextName || nextEmail || "U";

    setProfileLabel(nextProfileLabel);
    setAvatarImageUrl(avatarDraftImageUrl);
    persistAvatar(avatarDraftImageUrl);
    setDialogMode(null);
    dispatch(uiActions.showToast({ message: t("profile.dialog.profile.updated") }));
  }, [avatarDraftImageUrl, dispatch, emailDraft, nameDraft, t]);

  const onOpenAvatarPicker = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const onChangeAvatar = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      dispatch(uiActions.showToast({ message: t("profile.toast.imageOnly") }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAvatarDraftImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }, [dispatch, t]);

  const onRemoveAvatar = useCallback(() => {
    setAvatarDraftImageUrl(null);
  }, []);

  const onOpenProfileMenu = useCallback(
    (e: React.MouseEvent) => {

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dispatch(
        uiActions.openContextMenu({
          x: rect.right,
          y: rect.bottom + 8,
          items: [
            { label: t("profile.menu.logout"), onClick: onLogout },
            { label: t("profile.menu.settings"), onClick: onOpenSettingsDialog },
          ],
        })
      );
    },
    [dispatch, onLogout, onOpenSettingsDialog, t]
  );

  const headerMode: HeaderMode = (() => {
    if (id && isDocRoute) return "docText";
    return "default";
  })();

    return (
    <header className={styles.gnbWrap} aria-label={t("layout.sidebar.topBar")}>
      <div className={styles.gnbLeft}>
        <Button
          type="button"
          variant="ghost"
          size="s"
          className={styles.mobileLogoBtn}
          onClick={onOpenMobileMenu}
          aria-label={t("common.actions.openMenu")}
        >
          <Icon name="logo" source="url" basePath="/icons" size={40} />
        </Button>
      </div>

      <div className={styles.gnbRight}>
        {headerMode === "docText" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={`${styles.iconActionBtn} ${styles.favoriteBtn} ${isPinned ? styles.favoriteBtnActive : ""}`}
              onClick={onTogglePinned}
              title={isPinned ? t("document.detail.actions.unpin") : t("document.detail.actions.pin")}
              aria-pressed={isPinned}
            >
              <Icon name="star" size={22} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="s"
              className={`${styles.iconActionBtn} ${styles.trashBtn}`}
              onClick={onMoveToTrash}
              title={t("document.detail.actions.moveToTrash")}
              aria-label={t("document.detail.actions.moveToTrash")}
            >
              <Icon name="trash" source="url" basePath="/icons" size={19} />
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="s"
          className={styles.menuBtn}
          onClick={onOpenProfileMenu}
          aria-label={t("profile.menu.open")}
        >
          <span className={styles.avatar} aria-hidden="true">
            {avatarImageUrl ? (
              <img className={styles.avatarImage} src={avatarImageUrl} alt="" />
            ) : (
              avatarInitial
            )}
          </span>
        </Button>
      </div>
      {dialogMode && createPortal(
        <div className={styles.dialogViewport} role="presentation">
          <button
            type="button"
            className={styles.dialogBackdrop}
            aria-label={t("profile.dialog.closeAria")}
            onClick={onCloseDialog}
          />
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            aria-describedby="profile-dialog-description"
          >
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeading}>
                <span className={styles.dialogEyebrow}>
                  {dialogMode === "settings"
                    ? t("profile.dialog.settings.eyebrow")
                    : t("profile.dialog.profile.eyebrow")}
                </span>
                <h2 id="profile-dialog-title" className={styles.dialogTitle}>
                  {dialogMode === "settings"
                    ? t("profile.dialog.settings.title")
                    : t("profile.dialog.profile.title")}
                </h2>
                <p id="profile-dialog-description" className={styles.dialogDescription}>
                  {dialogMode === "settings"
                    ? t("profile.dialog.settings.description")
                    : t("profile.dialog.profile.description")}
                </p>
              </div>
              <button
                type="button"
                className={styles.dialogCloseButton}
                onClick={onCloseDialog}
                aria-label={t("profile.dialog.closeAria")}
              >
                ×
              </button>
            </div>

            {dialogMode === "settings" ? (
              <div className={styles.dialogBody}>
                <section className={styles.settingsPanel}>
                  <div className={styles.settingsPanelHeader}>
                    <strong className={styles.settingsPanelTitle}>{t("profile.dialog.settings.account.title")}</strong>
                    <span className={styles.settingsPanelDescription}>
                      {t("profile.dialog.settings.account.description")}
                    </span>
                  </div>

                  <div className={styles.dialogSection}>
                    <div className={styles.accountSummary}>
                      <span className={styles.accountAvatar} aria-hidden="true">
                        {avatarImageUrl ? (
                          <img className={styles.avatarImage} src={avatarImageUrl} alt="" />
                        ) : (
                          avatarInitial
                        )}
                      </span>
                      <div className={styles.sectionCopy}>
                        <strong className={styles.sectionTitle}>
                          {derivedName || t("profile.dialog.profile.nameDefault")}
                        </strong>
                        <span className={styles.sectionDescription}>
                          {derivedEmail || t("profile.dialog.profile.missingEmail")}
                        </span>
                      </div>
                    </div>
                    <div className={styles.settingsInlineActions}>
                      <span className={styles.statusBadge}>{t("profile.dialog.settings.status.active")}</span>
                      <button
                        type="button"
                        className={styles.secondaryInlineButton}
                        onClick={onOpenProfileDialog}
                      >
                        {t("profile.menu.edit")}
                      </button>
                    </div>
                  </div>
                </section>

                <section className={styles.settingsPanel}>
                  <div className={styles.settingsPanelHeader}>
                    <strong className={styles.settingsPanelTitle}>{t("profile.dialog.settings.system.title")}</strong>
                    <span className={styles.settingsPanelDescription}>
                      {t("profile.dialog.settings.system.description")}
                    </span>
                  </div>

                  <div className={styles.dialogSection}>
                    <div
                      className={`${styles.segmentedControl} ${styles.themeSegmentedControl}`}
                      role="group"
                      aria-label={t("profile.dialog.settings.theme.aria")}
                    >
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${styles.themeSegmentButton} ${theme === "system" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setTheme("system")}
                        aria-pressed={theme === "system"}
                      >
                        {t("profile.dialog.settings.theme.system")}
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${styles.themeSegmentButton} ${theme === "light" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setTheme("light")}
                        aria-pressed={theme === "light"}
                      >
                        {t("profile.dialog.settings.theme.light")}
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${styles.themeSegmentButton} ${theme === "dark" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setTheme("dark")}
                        aria-pressed={theme === "dark"}
                      >
                        {t("profile.dialog.settings.theme.dark")}
                      </button>
                    </div>
                  </div>

                  <div className={styles.dialogSection}>
                    <div className={styles.sectionCopy}>
                      <strong className={styles.sectionTitle}>{t("profile.dialog.settings.language.title")}</strong>
                      <span className={styles.sectionDescription}>
                        {t("profile.dialog.settings.language.description", { language: languageLabel })}
                      </span>
                    </div>
                    <div className={styles.segmentedControl} role="group" aria-label={t("profile.dialog.settings.language.aria")}>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${language === "en" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setLanguage("en")}
                        aria-pressed={language === "en"}
                      >
                        {t("common.language.english")}
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${language === "ko" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setLanguage("ko")}
                        aria-pressed={language === "ko"}
                      >
                        {t("common.language.korean")}
                      </button>
                    </div>
                  </div>
                </section>

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={onCloseDialog}
                  >
                    {t("common.actions.close")}
                  </button>
                </div>
              </div>
            ) : (
              <form className={styles.dialogBody} onSubmit={onSaveProfile}>
                <div className={styles.profileHero}>
                  <div className={styles.avatarEditor}>
                    <span className={styles.avatarLarge} aria-hidden="true">
                      {avatarDraftImageUrl ? (
                        <img className={styles.avatarLargeImage} src={avatarDraftImageUrl} alt="" />
                      ) : (
                        avatarInitial
                      )}
                    </span>
                    <button
                      type="button"
                      className={styles.avatarEditButton}
                      onClick={onOpenAvatarPicker}
                    >
                      {t("profile.dialog.avatar.change")}
                    </button>
                  </div>
                  <div className={styles.profileSummary}>
                    <strong>{nameDraft.trim() || derivedName || t("profile.dialog.profile.nameDefault")}</strong>
                    <span>{emailDraft.trim() || derivedEmail || t("profile.dialog.profile.missingEmail")}</span>
                    <div className={styles.avatarActions}>
                      <button
                        type="button"
                        className={styles.secondaryInlineButton}
                        onClick={onOpenAvatarPicker}
                      >
                        {t("profile.dialog.avatar.select")}
                      </button>
                      <button
                        type="button"
                        className={styles.ghostInlineButton}
                        onClick={onRemoveAvatar}
                      >
                        {t("profile.dialog.avatar.remove")}
                      </button>
                    </div>
                  </div>
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={onChangeAvatar}
                />

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("profile.dialog.profile.nameLabel")}</span>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder={t("profile.dialog.profile.namePlaceholder")}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t("profile.dialog.profile.emailLabel")}</span>
                  <input
                    type="email"
                    className={styles.fieldInput}
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder={t("profile.dialog.profile.emailPlaceholder")}
                  />
                </label>

                {user?.id ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>{t("profile.dialog.profile.userId")}</span>
                    <span className={styles.metaValue}>{user.id}</span>
                  </div>
                ) : null}

                <p className={styles.dialogNote}>
                  {t("profile.dialog.profile.note")}
                </p>

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={onCloseDialog}
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button type="submit" className={styles.primaryButton}>
                    {t("common.actions.save")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}

export { Gnb };
