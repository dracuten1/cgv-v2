package kinship

import "github.com/dracuten1/cgv-v2/api/internal/model"

// Node represents a member in the family graph with metadata needed for kinship calculation.
type Node struct {
	ID              string
	FamilyID        string
	FullName        string
	Gender          model.Gender
	GenerationIndex int
	BirthYear       int // 0 if unknown
	IsLiving        bool
}

// EdgeKind indicates whether an edge is parent-child or marriage.
type EdgeKind int

const (
	EdgeParentToChild EdgeKind = iota
	EdgeChildToParent
	EdgeSpouse
)

// NeighborEdge is a directed edge representation in adjacency list.
type NeighborEdge struct {
	TargetID string
	Kind     EdgeKind
}

// Graph holds the in-memory representation of a family tree.
type Graph struct {
	FamilyID string
	Version  int64

	Nodes map[string]*Node

	// Parents map: childID -> list of parentIDs (directed upward in lineage)
	Parents map[string][]string

	// Children map: parentID -> list of childIDs (directed downward in lineage)
	Children map[string][]string

	// Spouses map: memberID -> list of spouseIDs (bidirectional)
	Spouses map[string][]string

	// Adjacency for Dijkstra / generic search
	Adjacency map[string][]NeighborEdge
}

// NewGraph builds an in-memory graph from members, parent-child edges, and spouses edges.
func NewGraph(familyID string, version int64, members []model.Member, parentChild []model.ParentChild, spouses []model.Spouse) *Graph {
	g := &Graph{
		FamilyID:  familyID,
		Version:   version,
		Nodes:     make(map[string]*Node, len(members)),
		Parents:   make(map[string][]string),
		Children:  make(map[string][]string),
		Spouses:   make(map[string][]string),
		Adjacency: make(map[string][]NeighborEdge),
	}

	for _, m := range members {
		birthYear := 0
		if m.BirthDate != nil {
			birthYear = m.BirthDate.Year()
		}
		g.Nodes[m.ID] = &Node{
			ID:              m.ID,
			FamilyID:        m.FamilyID,
			FullName:        m.FullName,
			Gender:          m.Gender,
			GenerationIndex: m.GenerationIndex,
			BirthYear:       birthYear,
			IsLiving:        m.IsLiving,
		}
	}

	for _, pc := range parentChild {
		// Only consider edges where both nodes exist
		if _, ok := g.Nodes[pc.ParentID]; !ok {
			continue
		}
		if _, ok := g.Nodes[pc.ChildID]; !ok {
			continue
		}

		g.Parents[pc.ChildID] = append(g.Parents[pc.ChildID], pc.ParentID)
		g.Children[pc.ParentID] = append(g.Children[pc.ParentID], pc.ChildID)

		// Adjacency
		g.Adjacency[pc.ParentID] = append(g.Adjacency[pc.ParentID], NeighborEdge{
			TargetID: pc.ChildID,
			Kind:     EdgeParentToChild,
		})
		g.Adjacency[pc.ChildID] = append(g.Adjacency[pc.ChildID], NeighborEdge{
			TargetID: pc.ParentID,
			Kind:     EdgeChildToParent,
		})
	}

	for _, sp := range spouses {
		if _, ok := g.Nodes[sp.MemberA]; !ok {
			continue
		}
		if _, ok := g.Nodes[sp.MemberB]; !ok {
			continue
		}

		g.Spouses[sp.MemberA] = append(g.Spouses[sp.MemberA], sp.MemberB)
		g.Spouses[sp.MemberB] = append(g.Spouses[sp.MemberB], sp.MemberA)

		g.Adjacency[sp.MemberA] = append(g.Adjacency[sp.MemberA], NeighborEdge{
			TargetID: sp.MemberB,
			Kind:     EdgeSpouse,
		})
		g.Adjacency[sp.MemberB] = append(g.Adjacency[sp.MemberB], NeighborEdge{
			TargetID: sp.MemberA,
			Kind:     EdgeSpouse,
		})
	}

	return g
}
