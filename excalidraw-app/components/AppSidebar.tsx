import React from "react";
import { DefaultSidebar, Sidebar, THEME } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import { GitHubFileExplorer } from "./GitHubFileExplorer";
import "./AppSidebar.scss";

type SidebarPromoCopyProps = {
  text: string;
};

const SidebarPromoCopy = (props: SidebarPromoCopyProps) => {
  return (
    <div className="app-sidebar-promo-copy">
      <div className="app-sidebar-promo-illustration" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 300 250"
          className="app-sidebar-promo-heart"
        >
          <path
            d="M 145 75
           C 110 35, 60 55, 65 120
           C 70 180, 140 190, 215 200
           C 225 180, 260 110, 235 55
           C 210 -5, 140 20, 160 105"
            fill="none"
            stroke="#D06B64"
            strokeWidth="16"
            strokeLinecap="round"
          />
        </svg>

        <div className="app-sidebar-promo-trial-note excalifont">
          14 days of
          <br />
          free trial
        </div>
        <svg
          className="app-sidebar-promo-trial-arrow"
          viewBox="0 0 72 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 6C23 1 50 8 48 32"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M42 26L48 32L54 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="app-sidebar-promo-text">{props.text}</div>
    </div>
  );
};

const githubTabIcon = (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export const AppSidebar = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const { theme, openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="github"
          style={{ opacity: openSidebar?.tab === "github" ? 1 : 0.4 }}
          title="GitHub File Explorer"
        >
          {githubTabIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>

      <Sidebar.Tab tab="github">
        <GitHubFileExplorer excalidrawAPI={excalidrawAPI} />
      </Sidebar.Tab>

      <Sidebar.Tab tab="comments">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/sidebar-comments-promo-${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.9,
            }}
          />
          <SidebarPromoCopy text="Make comments with Excalidraw+" />
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=comments_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/sidebar-presentation-promo-${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.7,
            }}
          />
          <SidebarPromoCopy text="Create presentation with Excalidraw+" />
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=presentations_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
