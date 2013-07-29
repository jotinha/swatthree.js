# -*- coding: utf-8 -*-
"""
Created on Fri May 10 01:17:21 2013

@author: jsousa
"""

import os
import simplejson
from collections import defaultdict
from scntypes import *

def exists(texture):
    return os.path.exists('textures/'+texture+'.bmp') or \
           os.path.exists('textures/'+texture+'.tga') 

   
def _expand_tex_paths(textures,dir='pngs',fmt='png'):
    dir = dir.strip()
    if not dir.endswith('/'):
        dir += '/'
    paths = []
    for texture in textures:
        fname = dir + texture + '.tga.' + fmt
        if os.path.exists(fname):
            paths.append(fname)
        else:
            fname = dir + texture + '.' + fmt
            paths.append(fname)
    return paths

def _json_scn(scn):
    lightmaps = scn.lightmaps.masterBitmaps_files.values()
    textures = []
   
    return {
        "solids": [_json_solid(scn,solid,textures,lightmaps) for solid in scn.solids],
        "textures" : _expand_tex_paths(textures),
        "lightmaps": lightmaps
        }

def _json_ents(scn):
    ents = []
    for ent in scn.entities:
        e = ent.items
        e['srefidx'] = ent.srefidx
        ents.append(e)
    return ents

    
def _json_cells(solid,surf2faces):
    def _json_bvh(bvh):
        #transform surface list into face list
        faces = []        
        for s in bvh['surfs']:
            faces.extend(surf2faces[s])
        
        bvh2 = {
            'bbox': format_bbox(bvh['bbox']),
            'faceIdxs': faces,
            'children': [ _json_bvh(bb) for bb in bvh['children']]
        }
        return bvh2
    
    return [{
            'name': c.name,
            'skybox': c.skybox,
            'portals': [{
                #there are name and vertices in portals too, but i don't think its usefull right now
                'bbox': [portal.bb_verts[0]._aslist(),portal.bb_verts[1]._aslist()],
                'plane': [portal.plane.a,portal.plane.b,portal.plane.c,portal.plane.d],
                'nextcell': portal.nextcell,
                'verts': [v._aslist() for v in portal.verts],
                } for portal in c.portals],
            'bvh': _json_bvh(c.bvh),
        } for c in solid.rawcells]

def _json_nodes(solid):
    return [
        [n.nodep,n.node1,n.node2,n.cell,n.plane] for n in solid.nodes]

def _json_planes(solid):
    return [[p.a,p.b,p.c,p.d] for p in solid.planes]
    
def _json_solid(scn,solid,textures,lightmaps):
    
    verts = [[v.x,v.y,v.z] for v in solid.verts]
    uvs = [[uv.u,uv.v] for uv in solid.uvs]    
    idxs = list(solid.vertidxs)
    uvidxs = list(solid.uvidxs)
    faces = []
    
    #add textures to textures array
    textures.extend(list(set(surf.texture for surf in solid.surfs)))
    #create materials list
    materials = []      
    
    cell2surfs = []
    surf2cells = defaultdict(lambda : -1)
    for icell in xrange(len(solid.rawcells)):
        csurfs = solid.getSurfacesOnCell(icell)
        cell2surfs.append(csurfs)
        for isurf in csurfs:
            if surf2cells.has_key(isurf):
                raise SystemError('surface was already assigned to a cell!')
            surf2cells[isurf] = icell
   
    def addface(i1,i2,i3,surf,hlmap,cellIdx):
        """ 
        a face is a collection of 3 vertices with the following structure:
            [
                vertexIdx1, vertexIdx2, vertexIdx3,         #indexes of vertices
                uvIdx1, uvIdx2, uvIdx3,                     #uv indexes
                lmapUvMult_w, lmapUvMult_h, lmapUvMult_x0, lmapUvMult_y0, #multipliers to get uv2 indexes from uv1
                materialIdx                                 #index into unique materials array
                cellIdx                                     #index of cell this surface belongs to
                vertex1RGBA, vertex2RGBA, vertex3RGBA       #optional
            ]
        
        """
        texture = surf.texture
        istart = surf.vertidxstart
        face = [
            idxs[istart+i1],idxs[istart+i2],idxs[istart+i3],
            uvidxs[istart+i1],uvidxs[istart+i2],uvidxs[istart+i3],
        ]

        face.extend(hlmap.uv_mults[:])
    
        lmapId = scn.lightmaps.getMasterBitmapId(hlmap)
        if lmapId[1] == -1:
            lmapIdx = -1

        else:
            lmapIdx = lightmaps.index(scn.lightmaps.masterBitmaps_files[lmapId])
        #define a material as a unique indexes into texture array, key of
        #lightmaps dictionary, surface alpha, and wether surface has vertexcolors
        mat = (
            textures.index(texture),
            lmapIdx,
            surf.alpha,
            surf.hasVertexColors)
        
        if mat in materials:
            materialIdx = materials.index(mat)
        else:
            materials.append(mat)
            materialIdx = len(materials)-1
    
        face.append(materialIdx)
        face.append(cellIdx)
    
        if surf.hasVertexColors:       #if shading information
            face.append(surf.vertexColors[i1])  #RGBA colors
            face.append(surf.vertexColors[i2])
            face.append(surf.vertexColors[i3])
        
        faces.append(face)

    surf2faces = []
    fi = 0
    for isurf,surf in enumerate(solid.surfs):
        surf2faces.append([])
        #create triangle fan
        istart = surf.vertidxstart
        for i in range(1,surf.n_verts-1):
            addface(0,i,i+1,surf,solid.hlmaps[isurf],surf2cells[isurf])
            surf2faces[isurf].append(fi)
            fi += 1
    
    return {
        "verts": verts,
        "uvs": uvs,
        "faces": faces,
        "materials": materials,
        "cells": _json_cells(solid,surf2faces),
        "nodes": _json_nodes(solid),
        "planes": _json_planes(solid),
        }

def export_json(fname,scn):
    if not hasattr(scn.lightmaps,'masterBitmaps_files'):
        scn.lightmaps.export()
    
    s = _json_scn(scn)
    s['ents'] = _json_ents(scn)
    
    simplejson.dump(s,open(fname,'wt'))
    
def export_bufferGeom(fname,scn):
    if not hasattr(scn.lightmaps,'masterBitmaps_files'):
        scn.lightmaps.export()
    flatten = lambda l: reduce(lambda a,b: a+ b, l)
    
    solid = m.worldspawn    
    s = { 'vertidxs': solid.vertidxs,
          'positions': flatten( [v.x,v.y,-v.z] for v in solid.verts),
          'surfs': [[surf.vertidxstart,surf.n_verts] for surf in solid.surfs],
          'uvidxs': solid.uvidxs,
          'uvs': flatten([uv.u, uv.v] for uv in solid.uvs),
    }
    
    simplejson.dump(s,open(fname,'wt'))

if __name__ == "__main__":
#    export_json('missiona.json',m)
    export_bufferGeom('missiona_bg.json',m)
#    j = _json_scn(m)    