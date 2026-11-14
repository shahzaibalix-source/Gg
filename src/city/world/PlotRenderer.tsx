import React from 'react';
import { CityTextureSet } from '../materials/proceduralTextures';
import { ConstructionDraft, TimeOfDay, TownPlot } from '../types';
import { SIDEWALK_HEIGHT } from './MasterTownBlueprint';
import { HouseModel } from '../assets/HouseModel';
import { CommercialBuilding } from '../assets/CommercialModels';
import { CivicOrEntertainmentBuilding } from '../assets/CivicAndEntertainmentModels';
import { PlotNameplateSign, StylizedTree } from '../assets/FoliageAndProps';
import { createBusinessPreset, HOUSE_PRESETS } from '../registry/CityRegistry';

interface PlotRendererProps {
  plots: TownPlot[];
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  selectedPlotId: string | null;
  constructionDraft: ConstructionDraft;
  openDoors?: Record<string, boolean>;
  onSelectPlot: (plot: TownPlot) => void;
}

/**
 * Renders every TownPlot across all 6 districts + Central Square:
 * residential homes, luxury villas with pools, commercial storefronts,
 * civic/entertainment complexes, reserved expansion land, and editor ghost previews.
 */
export const PlotRenderer: React.FC<PlotRendererProps> = ({
  plots,
  textures,
  timeOfDay,
  selectedPlotId,
  constructionDraft,
  openDoors = {},
  onSelectPlot,
}) => {
  return (
    <group>
      {plots.map((plot) => {
        const isEmptyTarget =
          !plot.house && !plot.business && !plot.publicBuilding && plot.category !== 'public';
        const isGhostTarget =
          constructionDraft.mode !== 'idle' &&
          constructionDraft.targetPlotId === plot.id &&
          isEmptyTarget;
        const isBuildHighlight = constructionDraft.mode !== 'idle' && isEmptyTarget;
        const isMoveSource =
          constructionDraft.mode === 'move' && constructionDraft.sourcePlotId === plot.id;

        return (
          <SinglePlot
            key={plot.id}
            plot={plot}
            textures={textures}
            timeOfDay={timeOfDay}
            isSelected={selectedPlotId === plot.id}
            isMoveSource={isMoveSource}
            isBuildHighlight={isBuildHighlight}
            showGhostPreview={isGhostTarget}
            constructionDraft={isGhostTarget ? constructionDraft : undefined}
            doorOpen={Boolean(openDoors[plot.id])}
            onSelectPlot={onSelectPlot}
          />
        );
      })}
    </group>
  );
};

interface SinglePlotProps {
  plot: TownPlot;
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  isSelected: boolean;
  isMoveSource: boolean;
  isBuildHighlight: boolean;
  showGhostPreview: boolean;
  constructionDraft?: ConstructionDraft;
  doorOpen: boolean;
  onSelectPlot: (plot: TownPlot) => void;
}

const SinglePlot: React.FC<SinglePlotProps> = React.memo(({
  plot,
  textures,
  timeOfDay,
  isSelected,
  isMoveSource,
  isBuildHighlight,
  showGhostPreview,
  constructionDraft,
  doorOpen,
  onSelectPlot,
}) => {
  const { width, depth, house, business, publicBuilding, gardenTrees, category } = plot;
  const halfW = width / 2;
  const halfD = depth / 2;

  const isResidential =
    category === 'residential' ||
    category === 'luxury-residential' ||
    category === 'expansion-residential';
  const isCommercial = category === 'commercial' || category === 'expansion-commercial';
  const isExpansion =
    category === 'expansion-residential' ||
    category === 'expansion-commercial' ||
    category === 'expansion-public';

  const houseLocalX = house?.hasGarageCarport ? -0.8 : -0.4;
  const houseLocalZ = -1.2;
  const drivewayX = halfW - 2.65;
  const drivewayWidth = 3.1;
  const drivewayLen = halfD - 1.0;

  const previewRot = ((constructionDraft?.rotationQuarterTurns ?? 0) * Math.PI) / 2;

  const stakeColor =
    category === 'expansion-commercial'
      ? '#3b82f6'
      : category === 'expansion-public'
        ? '#f59e0b'
        : '#4f8c5a';

  return (
    <group
      position={[plot.center.x, 0, plot.center.z]}
      rotation={[0, plot.facingAngle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectPlot(plot);
      }}
    >
      {/* Plot Base Pad */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[width, SIDEWALK_HEIGHT, depth]} />
        <meshStandardMaterial
          map={isCommercial || publicBuilding ? textures.sidewalkStone : textures.grass}
          color={
            isCommercial
              ? '#cfc8ba'
              : publicBuilding
                ? '#c9c5bb'
                : category === 'luxury-residential'
                  ? '#6ea159'
                  : '#7ea863'
          }
          roughness={0.92}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>

      {/* Residential / Luxury Driveway & Garden Walkways */}
      {isResidential && (
        <>
          <group position={[drivewayX, SIDEWALK_HEIGHT, 0]}>
            <mesh position={[0, 0.012, halfD - drivewayLen / 2]} receiveShadow>
              <boxGeometry args={[drivewayWidth, 0.024, drivewayLen]} />
              <meshStandardMaterial map={textures.cobblestone} color="#c8bfb0" roughness={0.86} />
            </mesh>
            <mesh position={[0, 0.014, halfD + 1.4]} receiveShadow>
              <boxGeometry args={[drivewayWidth, 0.024, 2.8]} />
              <meshStandardMaterial map={textures.cobblestone} color="#c1b8a8" roughness={0.86} />
            </mesh>
          </group>

          <mesh
            position={[houseLocalX, SIDEWALK_HEIGHT + 0.012, (halfD + (houseLocalZ + 3.8)) / 2]}
            receiveShadow
          >
            <boxGeometry args={[1.5, 0.024, Math.max(1.2, halfD - (houseLocalZ + 3.8))]} />
            <meshStandardMaterial map={textures.sidewalkStone} color="#ddd5c7" roughness={0.86} />
          </mesh>

          {/* Side Boundary Hedges & Rear Fence */}
          <mesh position={[-halfW + 0.28, SIDEWALK_HEIGHT + 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.8, depth - 0.8]} />
            <meshStandardMaterial color="#3d6336" roughness={0.9} />
          </mesh>
          <mesh position={[halfW - 0.28, SIDEWALK_HEIGHT + 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.8, depth - 0.8]} />
            <meshStandardMaterial color="#3d6336" roughness={0.9} />
          </mesh>
          <mesh position={[0, SIDEWALK_HEIGHT + 0.52, -halfD + 0.18]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.8, 1.04, 0.16]} />
            <meshStandardMaterial map={textures.timber} color="#8c6747" roughness={0.86} />
          </mesh>

          {/* Plot Nameplate Sign */}
          <PlotNameplateSign
            position={[houseLocalX - 2.0, SIDEWALK_HEIGHT, halfD - 0.95]}
            plotCode={plot.plotCode}
            ownerUsername={plot.ownerUsername}
          />
        </>
      )}

      {/* Luxury Backyard Swimming Pool */}
      {house?.hasPool && (
        <group position={[houseLocalX + 1.5, SIDEWALK_HEIGHT, -halfD + 2.4]}>
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[5.8, 0.06, 3.2]} />
            <meshStandardMaterial color="#dfd7c8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[5.1, 0.04, 2.5]} />
            <meshPhysicalMaterial
              color="#3ea8c9"
              roughness={0.08}
              metalness={0.14}
              clearcoat={0.95}
              envMapIntensity={1.4}
            />
          </mesh>
        </group>
      )}

      {/* Garden Trees */}
      {gardenTrees.map((tree, i) => (
        <StylizedTree
          key={`gt-${i}`}
          position={[tree.x, SIDEWALK_HEIGHT, tree.z]}
          scale={tree.scale}
          variant={tree.variant}
          rotationY={i * 1.4}
        />
      ))}

      {/* Built House, Business, Public Landmark OR Empty Plot Survey Stakes */}
      {house ? (
        <group position={[houseLocalX, SIDEWALK_HEIGHT, houseLocalZ]}>
          <HouseModel
            spec={house}
            textures={textures}
            timeOfDay={timeOfDay}
            doorOpen={doorOpen}
          />
        </group>
      ) : business ? (
        <group position={[0, SIDEWALK_HEIGHT, -0.6]}>
          <CommercialBuilding
            spec={business}
            textures={textures}
            timeOfDay={timeOfDay}
            doorOpen={doorOpen}
          />
        </group>
      ) : publicBuilding ? (
        <group position={[0, SIDEWALK_HEIGHT, 0]}>
          <CivicOrEntertainmentBuilding
            spec={publicBuilding}
            textures={textures}
            timeOfDay={timeOfDay}
          />
        </group>
      ) : (
        <group position={[0, SIDEWALK_HEIGHT, 0]}>
          {[
            [-4.2, -3.6],
            [4.2, -3.6],
            [-4.2, 3.6],
            [4.2, 3.6],
          ].map(([sx, sz], idx) => (
            <group key={idx} position={[sx, 0, sz]}>
              <mesh position={[0, 0.34, 0]} castShadow>
                <boxGeometry args={[0.1, 0.68, 0.1]} />
                <meshStandardMaterial color="#7b583b" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.62, 0]}>
                <boxGeometry args={[0.16, 0.16, 0.16]} />
                <meshStandardMaterial color={stakeColor} roughness={0.45} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.015, 0]} receiveShadow>
            <boxGeometry args={[8.4, 0.03, 7.2]} />
            <meshStandardMaterial
              map={textures.parkGravel}
              color={isExpansion ? '#d7cfbc' : '#d4cab4'}
              roughness={0.92}
            />
          </mesh>
        </group>
      )}

      {/* Construction Mode Live Footprint Ghost Preview */}
      {showGhostPreview && constructionDraft && (
        <group position={[0, SIDEWALK_HEIGHT, 0]} rotation={[0, previewRot, 0]}>
          {constructionDraft.buildingType === 'house' ? (
            <group>
              <mesh position={[0, 2.8, 0]}>
                <boxGeometry
                  args={[
                    HOUSE_PRESETS[constructionDraft.houseArchetype].width,
                    5.6,
                    HOUSE_PRESETS[constructionDraft.houseArchetype].depth,
                  ]}
                />
                <meshBasicMaterial color="#22c55e" transparent opacity={0.34} wireframe={false} />
              </mesh>
            </group>
          ) : (
            (() => {
              const biz = createBusinessPreset(
                constructionDraft.businessCategory,
                plot.id,
                'Preview',
              );
              return (
                <mesh position={[0, biz.height / 2, 0]}>
                  <boxGeometry args={[biz.width, biz.height, biz.depth]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.34} />
                </mesh>
              );
            })()
          )}
        </group>
      )}

      {/* Selection / Move Source / Valid Target Perimeter Highlight */}
      {(isSelected || isMoveSource || isBuildHighlight) && (
        <group position={[0, SIDEWALK_HEIGHT + 0.055, 0]}>
          {(() => {
            const hlColor = isMoveSource
              ? '#38bdf8'
              : isSelected
                ? '#e5b84b'
                : '#22c55e';
            const op = isSelected || isMoveSource ? 0.92 : 0.45;
            return (
              <>
                <mesh position={[0, 0, halfD - 0.14]}>
                  <boxGeometry args={[width - 0.2, 0.03, 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
                <mesh position={[0, 0, -halfD + 0.14]}>
                  <boxGeometry args={[width - 0.2, 0.03, 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
                <mesh position={[-halfW + 0.14, 0, 0]}>
                  <boxGeometry args={[0.2, 0.03, depth - 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
                <mesh position={[halfW - 0.14, 0, 0]}>
                  <boxGeometry args={[0.2, 0.03, depth - 0.2]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={op} />
                </mesh>
              </>
            );
          })()}
        </group>
      )}
    </group>
  );
});
