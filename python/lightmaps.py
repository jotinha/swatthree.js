# -*- coding: utf-8 -*-
"""
Created on Thu May  9 00:14:56 2013

@author: jsousa
"""
import os,os.path
from collections import defaultdict
from scntypes import *
import numpy as np
import matplotlib.pyplot as plt

_CHECKS_ = True
TEXSIZE = 128

class LMaps(object):
    def __init__(self,scn):
        super(LMaps,self).__init__()
        self.scn = scn
        self.file = scn.file
        self.file.seek(scn.header.lmaps_offset,0)
        
        self.loadSwitchableLMapHeaders()
        self.loadLMapsForEachSolid()
        self.createMasterBitmaps()

    
    def loadSwitchableLMapHeaders(self):
        """
        this defines the location and specification of a switchable light map,
        ie, some kind of bitmap to multiply (possibly) by the current
        light map to get final color when a light is turned on.
        
        There are scn.header.n_extralmaps of these, and they are defined
        in tSwitchableLMapHeader
        """
        n = self.scn.header.n_extralmaps
        self.hslmaps = read_struct(self.file,tSwitchableLMapHeader*n)


    def loadLMapsForEachSolid(self):
        """ 
        Each solid in the scn has a [[header0,header1,...], [lump0,lump1,...]]
        data section. Solids[>=1] don't appear to have lumps
        
        There is one header per surface in the solid. They are in defined and
        explained in tLMapHeader.
        
        A lump is a collection of raw bitmap data and there is one
        one lump per cell in the solid. There appears to be lumps in 
        solid[0]/worldspawn only.
        
        All lightmap headers will be saved into a list of lists, 
        self.hlmaps,  where the first index is the
        index of the solid, and the second index refers to a surface on that
        solid. There is one header for each surface in each solid.
        
        hlmaps will also be linked to the solid they belong to, so you can
        access it with scn.solid[i].hlmaps (length = scn.solid[i].n_surfs)
        
        All lumps will be saved into self.lumps list, with one per each cell.

        """
        self.hlmaps = []
        for solid in self.scn.solids:
            solid.hlmaps = read_struct(self.file,tLMapHeader*solid.header.n_surfs)
            self.hlmaps.append(solid.hlmaps)

            if solid is self.scn.solids[0]:
                self.loadLumps()
    
    def loadLumps(self):
        """
        lumps is a list of raw bitmap data. 
        There is a lump for each cell in the scn, with the following format: 
            
            int32       size    // length, in bytes, of data lump
            int32       unk     // ??
            byte[size]  data    //raw bitmap data
        """
        
        
        self.lumps = []
        for _ in range(self.scn.solids[0].header.n_cells):
            lump = read_struct(self.file,tLMapLump)
            #add attribute - read bytes            
            if lump.size > 0:
                lump.data = read_struct(self.file,c_byte*lump.size)
            
            self.lumps.append(lump)
            
    
    def getBitmap(self,solididx,surfidx):
        """
        read data from lumps and interpret as 24bits bitmaps 
        (1 byte for each of the 3 channels in a pixel - rgb).
        
        Returns a [w x h x 3] numpy arrays corresponding to a
        specific lighmap with index [solididxs][surfidx]
        
        """
        
        hlmap = self.hlmaps[solididx][surfidx]
        surf = self.scn.solids[solididx].surfs[surfidx]
        lump = self.lumps[hlmap.cellidx]
        w,h = surf.lmsize   #size of light map
        data = lump.data[ hlmap.offset : hlmap.offset + w*h*3]
        
        return np.array(data,dtype='uint8').reshape(h,w,3,order='C')

    def createMasterBitmaps(self):
        """
        create master light bitmaps by drawing the individual surface
        lightmaps into the corresponding masterbitmap. Master bitmaps are
        128x128, 24-bit rgb textures and there are as many as necessary to
        fit all lightmaps.
        
        Master bit maps are saved in memory only (in self.masterBitmaps, a dictionary
        where the key is the unique id of the bitmp). To export use:
        
            self.export()
        """
        
        masterBitmaps = defaultdict(lambda : np.zeros((TEXSIZE,TEXSIZE,3),dtype='uint8'))
        masterBitmaps_written = defaultdict(lambda : np.zeros((TEXSIZE,TEXSIZE),dtype='uint8'))
        
        for i,hlmaps1 in enumerate(self.hlmaps):
            for j,hlmap in enumerate(hlmaps1):
                if hlmap.unk == -1:
                    continue    #these surfaces are not lit
                
                #define masterbitmap to draw into
                id = self.getMasterBitmapId(hlmap)
                masterBitmap = masterBitmaps[id]
                masterBitmap_written = masterBitmaps_written[id]
                
                #get light bitmap for this surface
                lbitmap = self.getBitmap(i,j)
                
                #define location of lbitmap into master bitmap
                x0,y0 = hlmap.pos%TEXSIZE, hlmap.pos//TEXSIZE
                h,w,bpp = lbitmap.shape
                assert bpp == 3
                
                #put lbitmap into area of master bitmap
                masterBitmap[y0 : y0+h, x0 : x0+w] = lbitmap[:,:]
                
                #make sure we hadn't written there before
                mbwView = masterBitmap_written[y0 : y0+h, x0 : x0+w]
                if np.any(mbwView > 0):
                    print "WARNING: ovewritting somewhere in region" + \
                          "[%i:%i,%i:%i] in masterBitmap (%s)" % (
                          y0,y0+h,x0,x0+w,str(id))
                mbwView += 1
        
        self.masterBitmaps = masterBitmaps
    
    def export(self,dir='lightmaps',fmt='png'):
        dir = dir.strip()
        if not dir.endswith('/'):
            dir += '/'
        
        if not os.path.isdir(dir):
            os.makedirs(dir)
        
        self.namefmt = dir + self.scn.name + '_%i_%i.' + fmt
        
        self.masterBitmaps_files = {}
        for bmId,bmData in self.masterBitmaps.iteritems():
            fname = self.namefmt % bmId
            self.masterBitmaps_files[bmId] = fname

            print "Saving ", fname
            plt.imsave(fname,bmData,format = fmt)
    
    def getMasterBitmapId(self,hlmap):
        return hlmap.cellidx,hlmap.unk
            
    
        
        
        
        

        
        
        
    
    