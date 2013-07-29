# -*- coding: utf-8 -*-
import struct
import collections
import os
import re

from scntypes import *
from lightmaps import LMaps

class ScnError(Exception):
    pass

class Scn(object):
    def __init__(self,fname):
        super(Scn, self).__init__()
        self.name = os.path.splitext(os.path.basename(fname))[0]
        self.file = open(fname,'rb')
       
        self.loadHeader()
        self.loadSolids()
        print "Solids read. Current file position: ", self.file.tell()
        
        #after reading solids some data may still be left. What is this? It appears 
        #to contain names of the solidref idxs, if any
        self.loadEntities()
        self.loadLMaps()
        
        data_left = self._how_much_data_left()
        if data_left > 0:
            print "WARNING: Expected eof, but still some data left (%i bytes)" % data_left
        
        self.file.close()
    
    def _how_much_data_left(self):
        fpos = self.file.tell()
        self.file.seek(0,2)  #go to end of file
        data_left = self.file.tell() - fpos
        self.file.seek(fpos,0) #go back
        return data_left
        
    
    def loadHeader(self):
        self.file.seek(0)
        self.header = read_struct(self.file,tScnHeader)
        if (self.header.ents_offset != self.header.ents_offset2):
            raise ScnError, 'ents_offset != ents_offset2'

    def loadSolids(self):
        seekpos = self.header.solid0_offset
        self.solids = []
        for s in range(self.header.n_solids):
            print "\nSolid %i\n-------- " % s
            self.file.seek(seekpos)
            solid = ScnSolid(self.file)
            seekpos += solid.header.length
            diff = seekpos - self.file.tell()
            if diff > 0:
                print "%i bytes of data are not understood. Start at: %i " % (diff,self.file.tell())
            self.solids.append(solid)
            if s==0:
                self.worldspawn = solid
        
    def loadEntities(self):
        self.file.seek(self.header.ents_offset2,0)
        ent_t = collections.namedtuple('ent',('n_fields','srefidx','items'))
        def loadEntity():
            n_fields = read_u32(self.file)
            srefidx  = read_s32(self.file)
            items = {}
            for i in range(n_fields):
                keylen = read_u16(self.file)
                vallen = read_u16(self.file)
                k = read_cstring(self.file,keylen)
                v = read_cstring(self.file,vallen)
                items.update({k:v})
            return ent_t(n_fields,srefidx,items)
        
        self.entities = [loadEntity() for _ in range(self.header.n_ents)]

    def loadLMaps(self):
        self.file.seek(self.header.lmaps_offset)
        
        if self._how_much_data_left() > 0:
            self.lightmaps = LMaps(self)
        else:
            print "WARNING: No lightmaps found. Were they built?"
        
    def searchEnts(self,classname,mode='exact'):
        """
        search entities and return those that match classname
        
        mode can be 're_search' or 're_match' for regular expression or 'exact' for exact match (case insensitive)
        """
        if mode=='exact':
            cond = lambda ent: ent.items['classname'].lower() == classname.lower()
        elif mode == 're_search':
            cond = lambda ent: re.search(classname,ent.items['classname'],flags=re.IGNORECASE) is not None
        elif mode == 're_match':
            cond = lambda ent: re.match(classname,ent.items['classname'],flags=re.IGNORECASE) is not None
            
        else:
            raise SystemError, "Invalid mode: " + str(mode)
            
        return [ent for ent in self.entities if cond(ent)]
            

    def getLights(self):
        return self.searchEnts('light')

class ScnSolid(object):

    def __init__(self,file):
        "file must be in proper position to initialize"
        self.file = file;
        self.offset = self.file.tell()
        self.loadHeader()
        self.loadSurfs()
        self.loadNodes()
        self.loadPlanes()
        self.loadVerts()
        self.loadUVs()
        self.loadVertIdxs()
        self.loadUVIdxs()
        self.loadUnk()
        self.loadCells()
        self.loadNames()
    
    def loadHeader(self):
        self.header = read_struct(self.file,tSolidHeader)
   
    def loadSurfs(self):
        self.surfs = [];
        for s in range(self.header.n_surfs):
            surf = read_struct(self.file,tSurface)
            nverts = surf.n_verts
            #read shading if present (vertex colors)        
            if (surf.hasVertexColors):
                #4 colors per vertex
                surf.vertexColors = [
                    struct.unpack('B'*4,self.file.read(4)) for _ in range(nverts)]
                    
            self.surfs.append(surf)
        
    def loadNodes(self):
        print "BSP tree nodes start at: ", self.file.tell()
        self.nodes = read_struct(self.file,tNode*self.header.n_nodes)
    
    def loadPlanes(self):
        print "Planes start at: ", self.file.tell()
        self.planes = read_struct(self.file,tPlane*self.header.n_planes)
    
    def loadVerts(self):
        self.verts = read_struct(self.file,tPoint3f*self.header.n_verts)
        
    def loadUVs(self):
        print "UV starts at: ", self.file.tell()
        self.uvs = read_struct(self.file,tPoint2f*self.header.n_uvs)
        
    def loadVertIdxs(self):
        fmt = str(self.header.n_vertidxs)+'I'
        self.vertidxs = struct.unpack(fmt,self.file.read(struct.calcsize(fmt)))
    
    def loadUVIdxs(self):
        fmt = str(self.header.n_vertidxs)+'I'
        self.uvidxs = struct.unpack(fmt,self.file.read(struct.calcsize(fmt)))
    
    def loadUnk(self):
        "About this lump only know it's 9 floats per surface"
        self.unkLump = [read_f32(self.file,9) for _ in range(self.header.n_surfs)]
        #self.file.seek(36*self.header.n_surfs,1)
    
    def loadCells(self):
        def readPortal():
            portal = read_struct(self.file,tPortal)
            portal.verts = read_struct(self.file,tPoint3f*portal.n_verts)
            return portal
        
        def readCellData():
            #TODO: understand how PVS and relationaship between surfaces work

            naivesurfs = set()
            leafbbs = []
            def readOneBox():
                bb = read_struct(self.file,tBBox)
                n_children = read_u16(self.file)
                if n_children == 0: 
                    leafbbs.append(bb)
                n_surfs = read_u16(self.file)
                if n_surfs > 0:
                    s = read_u16(self.file,n=n_surfs)
                    if n_surfs == 1:
                        s = [s]
                else:
                    s = []
                naivesurfs.update(s)

                return {
                    'bbox':bb,
                    'surfs': s,
                    'children':[readOneBox() for _ in xrange(n_children)],
                    }
                
            b = readOneBox()
            return b,naivesurfs,leafbbs
        
        self.rawcells = [];        
        for _ in xrange(self.header.n_cells):
            cell = read_struct(self.file,tRawCell)
            cell.nodeidxs = read_u16(self.file,cell.n_nodesidxs)
            cell.portals = [readPortal() for _ in xrange(cell.n_portals)]
            cell.bvh,cell.naivesurfs,cell.leafbbs = readCellData()
            
            self.rawcells.append(cell)

    def loadNames(self):
        """
        this is just a list of strings, 32 bytes each. They represent the
        names of special geometry in the solid, such as func_solidref entities
        and portals
        """
        
        self.names = [read_cstring(self.file,32) for _ in range(self.header.n_names)]
        
    def getSurfacesOnCell(self,cellIdx):
        return list(self.rawcells[cellIdx].naivesurfs)


if __name__ == "__main__":
    from export import export_json
    #os.chdir('/home/jsousa/swat3/scn2json')
    os.chdir('../bin')
    m = Scn('missiona.scn')
#    export_bufferGeom('missiona_bg.json',m)    
#    export_json('missiona.json',m)
#lights = scn.getLights()