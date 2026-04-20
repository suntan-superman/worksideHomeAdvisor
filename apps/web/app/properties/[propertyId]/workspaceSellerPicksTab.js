import {
  getMediaAssetPrimaryLabel,
  getMediaAssetSummary,
} from './workspaceVisionHelpers';

export function WorkspaceSellerPicksTab({
  renderCollapsibleSection,
  listingCandidateAssets,
  sellerPickCategoryGroups,
  selectedMediaAsset,
  setSelectedMediaAssetId,
  setActivePhotoDetailsAsset,
  handleOpenAssetInVision,
  setActiveTab,
}) {
  return (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'seller_picks_summary',
        label: 'Seller picks',
        title: 'Current listing candidates',
        meta: `${listingCandidateAssets.length} selected`,
        defaultOpen: true,
        className: 'content-card workspace-collapsible-section',
        children: listingCandidateAssets.length ? (
          <div className="workspace-tab-stack">
            <p className="workspace-control-note">
              These are the photos currently prioritized for the flyer, report, and listing flow.
              Open details for a closer review or continue editing one in the Vision workspace.
            </p>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Seller picks</strong>
                <span>{listingCandidateAssets.length} chosen</span>
              </div>
              <div className="stat-card">
                <strong>Originals</strong>
                <span>
                  {listingCandidateAssets.filter((asset) => asset.assetType !== 'generated').length}
                </span>
              </div>
              <div className="stat-card">
                <strong>Saved from Vision</strong>
                <span>{listingCandidateAssets.filter((asset) => asset.savedFromVision).length}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="workspace-tab-stack">
            <p>No seller picks have been chosen yet.</p>
            <button
              type="button"
              className="button-primary"
              onClick={() => setActiveTab('photos')}
            >
              Go to Photos
            </button>
          </div>
        ),
      })}

      {sellerPickCategoryGroups.map((group) =>
        renderCollapsibleSection({
          sectionKey: `seller_picks_room_${group.key}`,
          label: 'Seller picks',
          title: group.label,
          meta: `${group.assets.length} photo${group.assets.length === 1 ? '' : 's'}`,
          defaultOpen: true,
          className: 'content-card workspace-collapsible-section photo-library-section',
          children: (
            <div className="photo-room-grid">
              {group.assets.map((asset) => (
                <article
                  key={`seller-pick-${asset.id}`}
                  className={
                    asset.id === selectedMediaAsset?.id
                      ? 'photo-library-card active'
                      : 'photo-library-card'
                  }
                >
                  <button
                    type="button"
                    className="photo-library-card-preview"
                    onClick={() => {
                      setSelectedMediaAssetId(asset.id);
                      setActivePhotoDetailsAsset(asset);
                    }}
                  >
                    <img src={asset.imageUrl} alt={asset.roomLabel || 'Seller pick'} />
                  </button>
                  <div className="photo-library-card-body">
                    <div className="photo-card-badge-row">
                      <span className="photo-card-status-pill">
                        {getMediaAssetPrimaryLabel(asset)}
                      </span>
                      <span className="photo-card-action-pill active">Seller Pick</span>
                    </div>
                    <strong>{asset.roomLabel}</strong>
                    <p className="photo-card-summary">{getMediaAssetSummary(asset)}</p>
                    <div className="photo-library-card-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          setSelectedMediaAssetId(asset.id);
                          setActivePhotoDetailsAsset(asset);
                        }}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleOpenAssetInVision(asset)}
                      >
                        Open in Vision
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ),
        }),
      )}
    </div>
  );
}
