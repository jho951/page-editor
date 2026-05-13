/**
 * 상단 글로벌 내비게이션 UI를 렌더링합니다.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
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
type AppLanguage = "ko" | "en";

const PROFILE_AVATAR_STORAGE_KEY = "editor.profile-avatar";
const PROFILE_AVATAR_REMOVED_SENTINEL = "__none__";
const APP_LANGUAGE_STORAGE_KEY = "editor.language";

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "ko";

  const stored = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  if (stored === "ko" || stored === "en") return stored;

  return window.navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

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
  const { theme, resolvedTheme, setTheme } = useTheme();

  const isDocRoute = location.pathname.startsWith("/doc/");

  const pinnedDocIds = useSelector(selectPinnedDocIds);
  const [profileLabel, setProfileLabel] = useState(profile);
  const [dialogMode, setDialogMode] = useState<ProfileDialogMode>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(() => readStoredAvatar() ?? null);
  const [avatarDraftImageUrl, setAvatarDraftImageUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
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

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    document.documentElement.lang = language;
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const derivedName = user?.name ?? (!String(profileLabel).includes("@") ? String(profileLabel) : "");
  const derivedEmail = user?.email ?? (String(profileLabel).includes("@") ? String(profileLabel) : "");
  const avatarInitial = String(profileLabel || "U").slice(0, 1).toUpperCase();
  const resolvedThemeLabel = resolvedTheme === "dark" ? "어두운 테마" : "밝은 테마";
  const languageLabel = language === "ko" ? "한국어" : "영어";

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
    dispatch(uiActions.showToast({ message: "내 정보 미리보기를 업데이트했습니다." }));
  }, [avatarDraftImageUrl, dispatch, emailDraft, nameDraft]);

  const onOpenAvatarPicker = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const onChangeAvatar = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      dispatch(uiActions.showToast({ message: "이미지 파일만 선택할 수 있습니다." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAvatarDraftImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }, [dispatch]);

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
            { label: "로그아웃", onClick: onLogout },
            { label: "설정", onClick: onOpenSettingsDialog },
            { label: "내 정보 수정", onClick: onOpenProfileDialog },
          ],
        })
      );
    },
    [dispatch, onLogout, onOpenProfileDialog, onOpenSettingsDialog]
  );

  const headerMode: HeaderMode = (() => {
    if (id && isDocRoute) return "docText";
    return "default";
  })();

    return (
    <header className={styles.gnbWrap} aria-label="Top bar">
      <div className={styles.gnbLeft}>
        <Button
          type="button"
          variant="ghost"
          size="s"
          className={styles.mobileLogoBtn}
          onClick={onOpenMobileMenu}
          aria-label="메뉴 열기"
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
              title={isPinned ? "즐겨찾기 해제" : "즐겨찾기 추가"}
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
              title="휴지통으로 이동"
              aria-label="휴지통으로 이동"
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
          aria-label="Open profile menu"
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
            aria-label="모달 닫기"
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
                  {dialogMode === "settings" ? "Workspace" : "Profile"}
                </span>
                <h2 id="profile-dialog-title" className={styles.dialogTitle}>
                  {dialogMode === "settings" ? "설정" : "내 정보 수정"}
                </h2>
                <p id="profile-dialog-description" className={styles.dialogDescription}>
                  {dialogMode === "settings"
                    ? "워크스페이스에서 바로 바꿀 수 있는 기본 설정입니다."
                    : "표시 이름과 연락용 이메일을 이 세션 기준으로 업데이트합니다."}
                </p>
              </div>
              <button
                type="button"
                className={styles.dialogCloseButton}
                onClick={onCloseDialog}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {dialogMode === "settings" ? (
              <div className={styles.dialogBody}>
                <section className={styles.settingsPanel}>
                  <div className={styles.settingsPanelHeader}>
                    <strong className={styles.settingsPanelTitle}>계정 설정</strong>
                    <span className={styles.settingsPanelDescription}>
                      현재 계정 상태를 확인하고 프로필 편집 모달로 이동할 수 있습니다.
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
                          {derivedName || "워크스페이스 사용자"}
                        </strong>
                        <span className={styles.sectionDescription}>
                          {derivedEmail || "로그인 사용자 정보가 없습니다."}
                        </span>
                      </div>
                    </div>
                    <div className={styles.settingsInlineActions}>
                      <span className={styles.statusBadge}>활성</span>
                      <button
                        type="button"
                        className={styles.secondaryInlineButton}
                        onClick={onOpenProfileDialog}
                      >
                        내 정보 수정
                      </button>
                    </div>
                  </div>
                </section>

                <section className={styles.settingsPanel}>
                  <div className={styles.settingsPanelHeader}>
                    <strong className={styles.settingsPanelTitle}>시스템 설정</strong>
                    <span className={styles.settingsPanelDescription}>
                      테마와 언어 선호값을 현재 브라우저 기준으로 즉시 적용합니다.
                    </span>
                  </div>

                  <div className={styles.dialogSection}>
                    <div className={styles.sectionCopy}>
                      <strong className={styles.sectionTitle}>테마</strong>
                      <span className={styles.sectionDescription}>
                        시스템 설정을 따르거나 직접 밝기 테마를 고를 수 있습니다. 현재 {resolvedThemeLabel} 적용 중
                      </span>
                    </div>
                    <div className={styles.segmentedControl} role="group" aria-label="테마 선택">
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${theme === "system" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setTheme("system")}
                        aria-pressed={theme === "system"}
                      >
                        시스템 설정
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${theme === "light" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setTheme("light")}
                        aria-pressed={theme === "light"}
                      >
                        밝은 테마
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${theme === "dark" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setTheme("dark")}
                        aria-pressed={theme === "dark"}
                      >
                        어두운 테마
                      </button>
                    </div>
                  </div>

                  <div className={styles.dialogSection}>
                    <div className={styles.sectionCopy}>
                      <strong className={styles.sectionTitle}>언어</strong>
                      <span className={styles.sectionDescription}>
                        앱 기본 언어 선호값을 저장합니다. 현재 {languageLabel}
                      </span>
                    </div>
                    <div className={styles.segmentedControl} role="group" aria-label="언어 선택">
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${language === "en" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setLanguage("en")}
                        aria-pressed={language === "en"}
                      >
                        영어
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentButton} ${language === "ko" ? styles.segmentButtonActive : ""}`}
                        onClick={() => setLanguage("ko")}
                        aria-pressed={language === "ko"}
                      >
                        한국어
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
                    닫기
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
                      이미지 변경
                    </button>
                  </div>
                  <div className={styles.profileSummary}>
                    <strong>{nameDraft.trim() || derivedName || "워크스페이스 사용자"}</strong>
                    <span>{emailDraft.trim() || derivedEmail || "이메일을 입력해 주세요."}</span>
                    <div className={styles.avatarActions}>
                      <button
                        type="button"
                        className={styles.secondaryInlineButton}
                        onClick={onOpenAvatarPicker}
                      >
                        파일 선택
                      </button>
                      <button
                        type="button"
                        className={styles.ghostInlineButton}
                        onClick={onRemoveAvatar}
                      >
                        제거
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
                  <span className={styles.fieldLabel}>이름</span>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder="이름 입력"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>이메일</span>
                  <input
                    type="email"
                    className={styles.fieldInput}
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder="name@example.com"
                  />
                </label>

                {user?.id ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>사용자 ID</span>
                    <span className={styles.metaValue}>{user.id}</span>
                  </div>
                ) : null}

                <p className={styles.dialogNote}>
                  저장하면 현재 브라우저에서 프로필 이미지와 표시 정보가 함께 반영됩니다.
                </p>

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={onCloseDialog}
                  >
                    취소
                  </button>
                  <button type="submit" className={styles.primaryButton}>
                    저장
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
