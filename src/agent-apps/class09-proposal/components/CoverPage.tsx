import React from 'react';
import type { ProposalDoc } from '../types';

interface Props {
  doc: ProposalDoc;
}

export const CoverPage: React.FC<Props> = ({ doc }) => {
  const latestVersion = doc.publishedVersions[doc.publishedVersions.length - 1];
  const createdDate = new Date(doc.createdAt).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] py-16 px-12 text-center border-b border-gray-200">
      {latestVersion && (
        <span className="mb-6 inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full tracking-wide">
          v{latestVersion.version}
        </span>
      )}
      <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
        {doc.title || '未命名企劃書'}
      </h1>
      {doc.metadata.purpose && (
        <p className="text-lg text-gray-500 mb-8 max-w-lg">{doc.metadata.purpose}</p>
      )}
      <div className="mt-auto pt-12 space-y-1 text-sm text-gray-400">
        {doc.metadata.targetAudience && (
          <p>目標對象：{doc.metadata.targetAudience}</p>
        )}
        {doc.metadata.tone && (
          <p>文件語氣：{doc.metadata.tone}</p>
        )}
        <p>建立日期：{createdDate}</p>
        {doc.metadata.pageCountEstimate > 0 && (
          <p>預估頁數：{doc.metadata.pageCountEstimate} 頁</p>
        )}
      </div>
    </div>
  );
};
